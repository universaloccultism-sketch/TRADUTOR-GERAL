
import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

export type TranslationProfile = 'Literária' | 'Fiel' | 'Natural';

export interface ChapterResult {
  id: string; // Unique ID for React keys
  original: string;
  translated: string | null;
  status: 'pending' | 'translating' | 'success' | 'failed';
  error?: string;
  chapterTitle?: string; // e.g., "Capítulo 1"
}

const diminutiveRule = `\n\nREGRA CRÍTICA E INQUEBRÁVEL: Sob nenhuma circunstância use diminutivos (terminações como "-inho", "-inha"). Por exemplo, traduza "little boy" como "menino pequeno" e NUNCA como "menininho". Traduza "little house" como "casa pequena" e NUNCA como "casinha". Esta regra deve ser seguida estritamente.`;

const getThirdLanguageHandlingRule = (sourceLanguage: string, targetLanguage: string) => `
\n\n**REGRA MESTRA DE TRADUÇÃO DE IDIOMAS:** Sua tarefa principal é traduzir TODO o texto do idioma de origem (${sourceLanguage}) para o idioma de destino (${targetLanguage}).

**REGRA CRÍTICA PARA TERCEIROS IDIOMAS:** Se o texto original contiver palavras, frases ou sentenças em um TERCEIRO idioma (que não seja ${sourceLanguage} nem ${targetLanguage}, como por exemplo Latim, Francês, Alemão, Grego, Hebraico etc.), você DEVE OBRIGATORIAMENTE E SEM EXCEÇÕES traduzir esse trecho para ${targetLanguage}. Não mantenha NADA no idioma original do terceiro idioma. 100% do texto final deve estar em ${targetLanguage}.

**Cenários de Aplicação:**
1.  **Trecho em terceiro idioma COM tradução subsequente no original:** Se o texto em ${sourceLanguage} contém um trecho em um terceiro idioma e o próprio autor já o traduziu para ${sourceLanguage} logo em seguida (ex: "...'alea iacta est', which means 'the die is cast'..."), você deve **IGNORAR** o trecho no terceiro idioma e usar apenas a tradução fornecida pelo autor para gerar o texto em ${targetLanguage}. O resultado deve ser natural e sem redundâncias.
2.  **Trecho em terceiro idioma SEM tradução subsequente no original:** Se o texto contém um trecho em um terceiro idioma e **NÃO** há uma tradução fornecida pelo autor, você **DEVE** traduzir este trecho diretamente para ${targetLanguage}.

**Exemplo de Aplicação (Cenário 2):**
Texto Original (${sourceLanguage}): \`Then he said, 'Alea iacta est'.\`
Sua Tradução (${targetLanguage}): \`Então ele disse, 'A sorte está lançada'.\` (CORRETO: A frase em Latim foi completamente traduzida).
Sua Tradução (${targetLanguage}): \`Então ele disse, 'Alea iacta est'.\` (ERRADO: A frase foi mantida no idioma original).

A aplicação rigorosa desta regra de tradução total é fundamental para a tarefa.
`;


const systemInstructions: Record<TranslationProfile, string> = {
  'Literária': `Você é um tradutor literário premiado, um mestre em transpor a alma de uma obra do inglês para o português do Brasil. Sua especialidade é realizar traduções que são obras de arte em si. Você captura todas as nuances culturais, gírias, expressões idiomáticas, trocadilhos, jogos de palavras, alusões, xingamentos, e o mais importante: o tom, o ritmo e o estilo únicos do autor. Sua tradução não é apenas correta, é evocativa. TRADUZA TUDO. Não deixe termos em inglês, a menos que seja um nome próprio ou um termo para o qual não exista absolutamente nenhum equivalente que mantenha o impacto. Sua tradução deve soar como se a obra tivesse sido originalmente sonhada e escrita em português por um grande autor brasileiro.`,
  'Fiel': `Você é um tradutor técnico e preciso. Sua tarefa é traduzir textos do inglês para o português do Brasil da forma mais literal e fiel possível, mantendo a estrutura da frase original sempre que viável. Priorize a exatidão terminológica sobre a fluidez. Evite interpretações criativas.`,
  'Natural': `Você é um tradutor focado em naturalidade e fluidez para o leitor brasileiro. Sua tarefa é traduzir textos do inglês para o português do Brasil de uma forma que soa completamente natural e coloquial. Adapte expressões idiomáticas e gírias para seus equivalentes mais comuns no Brasil. Priorize a clareza e a facilidade de leitura sobre a fidelidade estrita à estrutura original. A tradução deve parecer uma conversa ou um texto escrito por um falante nativo para outro.`
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function generateContentWithRetry(
  payload: any, 
  signal: AbortSignal, 
  maxRetries = 5 
): Promise<any> {
  let lastError: any = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (signal.aborted) {
      throw new DOMException('Translation aborted by user.', 'AbortError');
    }
    try {
      const response = await ai.models.generateContent(payload);
      return response;
    } catch (error) {
      lastError = error;
      console.error(`Attempt ${attempt + 1} failed.`, error);
      if (attempt < maxRetries - 1) {
        // Exponential backoff with jitter
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        console.log(`Retrying in ${Math.round(delay/1000)}s...`);
        await sleep(delay);
      }
    }
  }
  throw lastError;
}

// Regex to identify chapters. Supports "Capítulo X" or "Chapter X" with optional ".".
const CHAPTER_REGEX = /(^|\n\n)(Capítulo\s+\d+|Chapter\s+\d+)\.?\s*(?=\n\n|\s*|$)/gi;

export async function translateChapters(
    textToTranslate: string, 
    context: string, 
    profile: TranslationProfile,
    sourceLanguage: string,
    targetLanguage: string,
    onChapterUpdate: (chapter: ChapterResult) => void, // Callback for individual chapter updates
    signal: AbortSignal
): Promise<void> {
  const model = 'gemini-2.5-pro';

  const isSpecializedPair = sourceLanguage === 'Inglês' && targetLanguage === 'Português (Brasil)';
  let systemInstruction: string;
  const thirdLanguageRule = getThirdLanguageHandlingRule(sourceLanguage, targetLanguage);

  if (isSpecializedPair) {
      systemInstruction = systemInstructions[profile] + diminutiveRule + thirdLanguageRule;
  } else {
      systemInstruction = `Você é um tradutor especialista multilíngue. Sua tarefa é traduzir textos de ${sourceLanguage} para ${targetLanguage} com a maior precisão e naturalidade possível, respeitando o contexto fornecido.` + thirdLanguageRule;
  }

  const detectedChapters: { title: string; content: string; startIndex: number; }[] = [];
  let lastIndex = 0;
  
  // Find all chapter titles and their start indices
  const matches = [...textToTranslate.matchAll(CHAPTER_REGEX)];
  
  if (matches.length > 0) {
      for (let i = 0; i < matches.length; i++) {
          const match = matches[i];
          const chapterTitle = match[2].trim(); // e.g., "Capítulo 1" or "Chapter 2"
          const chapterStart = match.index! + match[1].length; // Start of the title itself
          const nextChapterStart = (i + 1 < matches.length) ? matches[i+1].index! : textToTranslate.length;
          
          let chapterContent = textToTranslate.substring(chapterStart, nextChapterStart).trim();
          
          // Remove the title from the content if it's at the very beginning of the content string
          if (chapterContent.startsWith(match[2].trim())) {
              chapterContent = chapterContent.substring(match[2].trim().length).trim();
          }

          detectedChapters.push({
              title: chapterTitle,
              content: chapterContent,
              startIndex: chapterStart
          });
          lastIndex = nextChapterStart;
      }
  } else {
      // If no chapters detected, treat the entire text as one chapter
      detectedChapters.push({
          title: 'Texto Completo',
          content: textToTranslate,
          startIndex: 0
      });
  }

  const initialChapterResults: ChapterResult[] = detectedChapters.map((ch, index) => ({
    id: `chapter-${index}`, // Unique ID
    original: ch.content,
    translated: null,
    status: 'pending',
    chapterTitle: ch.title,
  }));
  
  // Inform the UI about all pending chapters
  initialChapterResults.forEach(ch => onChapterUpdate(ch));

  const totalChapters = initialChapterResults.length;

  for (let i = 0; i < totalChapters; i++) {
    if (signal.aborted) {
        throw new DOMException('Translation aborted by user.', 'AbortError');
    }
    
    let currentChapterResult = initialChapterResults[i];
    onChapterUpdate({ ...currentChapterResult, status: 'translating' }); // Update status to translating

    const chapterText = currentChapterResult.original;
    
    if (!chapterText.trim()) {
      onChapterUpdate({
        ...currentChapterResult,
        status: 'success',
        translated: '', // Empty chapter, success with empty translation
      });
      continue; 
    }
    
    const textWithTitle = `${currentChapterResult.chapterTitle}\n\n${chapterText}`;

    const contextInstruction = context.trim() 
      ? `Para a tradução a seguir, considere o seguinte contexto sobre a obra: \n\n---INÍCIO DO CONTEXTO---\n${context}\n---FIM DO CONTEXTO---\n\n`
      : '';

    const chapterInstruction = totalChapters > 1
      ? `\n\nAVISO IMPORTANTE: Você está traduzindo um segmento de um texto maior. Mantenha a consistência de tom, estilo e terminologia com o contexto fornecido e com os outros capítulos. Não adicione introduções ou conclusões como se este fosse o texto completo.`
      : `\n\nAVISO IMPORTANTE: Você está traduzindo um texto completo.`;

    const prompt = `
${contextInstruction}${chapterInstruction}
Traduza o seguinte texto de ${sourceLanguage} para ${targetLanguage}, **incluindo o título do capítulo no início**. O resultado deve começar com o título traduzido, seguido por duas quebras de linha e então o conteúdo do capítulo.

---INÍCIO DO TEXTO A TRADUZIR---
${textWithTitle}
---FIM DO TEXTO A TRADUZIR---

Forneça APENAS o texto traduzido, sem nenhum comentário, explicação ou formatação adicional.
    `;

    try {
      const payload = {
        model: model,
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          // maxOutputTokens and thinkingConfig are not set here as per guidelines
        },
      };

      const response = await generateContentWithRetry(payload, signal);
      
      onChapterUpdate({
        ...currentChapterResult,
        status: 'success',
        translated: response.text,
        error: undefined, // Clear any previous error
      });

    } catch (error: any) {
       if (error instanceof DOMException && error.name === 'AbortError') {
         throw error; // Propagate abort error immediately
       }
      console.error(`Error translating chapter ${i + 1}/${totalChapters} after all retries:`, error);
      
      let userFriendlyMessage = `Falha ao traduzir o "${currentChapterResult.chapterTitle || `segmento ${i + 1}/${totalChapters}`}".`;
      if (error && typeof error.message === 'string') {
        const lowerCaseMessage = error.message.toLowerCase();
        if (lowerCaseMessage.includes('fetch') || lowerCaseMessage.includes('network')) {
           userFriendlyMessage += ' Houve um problema de conexão. Por favor, verifique sua internet.';
        } else if (lowerCaseMessage.includes('api key')) {
           userFriendlyMessage += ' Problema com a chave de API. Por favor, verifique as configurações.';
        } else if (lowerCaseMessage.includes('timed out') || lowerCaseMessage.includes('timeout')) {
           userFriendlyMessage += ' A requisição demorou demais para responder.';
        } else if (lowerCaseMessage.includes('429') || lowerCaseMessage.includes('quota')) {
            userFriendlyMessage += ' O limite de requisições foi atingido. Por favor, aguarde um pouco.';
        } else {
           userFriendlyMessage += ' Ocorreu um erro inesperado.';
        }
      } else {
        userFriendlyMessage += ' Verifique sua conexão ou tente novamente.';
      }

      onChapterUpdate({
        ...currentChapterResult,
        status: 'failed',
        error: userFriendlyMessage,
      });
      // Do NOT throw here; allow other chapters to continue if possible.
      // The `App.tsx` will check `chapterResults` for overall errors/progress.
    }
  }
}
