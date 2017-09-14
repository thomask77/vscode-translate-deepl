import * as vscode from "vscode"
import DeepL from "./deepl"

const wordwrap = require("wordwrap")
const config = vscode.workspace.getConfiguration("translate-deepl")


function splitIntoParagraphs(text: string): string[]
{
    let res: string[] = []
    let paragraph = ""

    text = text.replace(/\r\n/g, "\n")

    for (const line of text.split(/\n/g)) {
        // Split on empty lines
        //
        if (line.trim() != "") {
            paragraph += line + "\n"
        }
        else if (paragraph != "") {
            res.push(paragraph)
            paragraph = ""
        }
    }

    if (paragraph != "")
        res.push(paragraph)

    return res
}


async function translateText(text: string): Promise<string>
{
    const deepl = new DeepL()
    deepl.targetLang = config.get("targetLang") as string
    deepl.userPreferredLangs = config.get("userPreferredLangs") as string[]
    deepl.timeoutMs = config.get("timeoutMs") as number

    // Split into paragraphs to stay below the 5000 character limit
    //
    const paragraphs = splitIntoParagraphs(text)

    // Translate paragraphs in parallel to save time
    //
    const res = await Promise.all(
        paragraphs.map( async p => {
            const sentences  = await deepl.splitIntoSentences(p)
            const translated = await deepl.translateSentences(sentences)
            return translated.join(" ")  // join translated sentences
        })
    )

    return res.join("\n\n")  // join translated paragraphs
}


async function translateSelection()
{
    const editor = vscode.window.activeTextEditor
    if (!editor)
        return

    if (editor.selection.isEmpty)
        throw "No text selected"
       
    const text = editor.document.getText(editor.selection);
    
    // TODO
    // * lock editor until done
    //
    let translated = ""
    let status = vscode.window.setStatusBarMessage("Translating...")
    try {
        translated += await translateText(text)
    }
    finally {
        status.dispose()
    }

    // Wrap and insert translated text below the original
    //
    const wrapMargin = config.get("wrapMargin") as number
    if (wrapMargin)    
        translated = wordwrap(wrapMargin)(translated)
    
    const cursor = editor.selection.end
    
    await editor.edit(e => e.insert(cursor, "\n\n" + translated + "\n\n"))

    // Select translated text and scroll into view
    //
    editor.selection = new vscode.Selection(cursor, editor.selection.end)

    editor.revealRange(
        new vscode.Range(cursor.line, 0, cursor.line + 1, 0), 
        vscode.TextEditorRevealType.InCenterIfOutsideViewport
    )
}


export function activate(context: vscode.ExtensionContext)
{
    let disposables = [
        vscode.commands.registerCommand("translate-deepl", translateSelection)
    ]

    // Add to a list of disposables which are disposed when this extension is deactivated.
    //
    for (const d of disposables)
        context.subscriptions.push(d)
}

