import * as rpn from "request-promise-native"


export default class DeepL 
{
    endpoint = "https://www.deepl.com/jsonrpc";

    langUserSelected = "auto"
    targetLang = "EN"
    userPreferredLangs = ["EN", "DE"]
    timeoutMs = 10 * 1000
    
    public async splitIntoSentences(text: string): Promise<string[]>
    {
        // DeepL doesn't like line-breaks and spaces
        //
        text = text.replace(/[\r\n]/g, " ")
        text = text.replace(/ +/g, " ")
        text = text.trim()

        const body = await rpn.post( {
            uri: this.endpoint,
            timeout: this.timeoutMs,
            json: true,
            body: {
                jsonrpc: "2.0",
                method: "LMT_split_into_sentences",
                params: {
                    texts: [ 
                        text
                    ],
                    lang: {
                        lang_user_selected: this.langUserSelected
                    }
                },
                id: 1
            }
        } );

        if (!body.result.splitted_texts.length)
            return []
        
        return body.result.splitted_texts[0]
    }
    

    public async translateSentences(sentences: string[]): Promise<string[]>
    {    
        const body = await rpn.post( {
            uri: this.endpoint,
            timeout: this.timeoutMs,
            json: true, 
            body: {
                jsonrpc: "2.0",
                method: "LMT_handle_jobs",
                params: {
                    jobs: sentences.map( o => ({
                        kind: "default", 
                        raw_en_sentence: o
                    }) ),
                    lang: {
                        user_preferred_langs: this.userPreferredLangs,
                        target_lang: this.targetLang
                    },
                },
                id: 2
            }
        } )
        
        let res: string[] = []
        for (let t of body.result.translations)
            if (t.beams.length > 0)
                res.push(t.beams[0].postprocessed_sentence)
        
        return res
    }
}
