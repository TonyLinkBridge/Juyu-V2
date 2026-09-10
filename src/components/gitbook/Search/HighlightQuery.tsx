// Adapted from GitBook HighlightQuery; literal React text, no HTML injection.
import {foldSearchText} from '../../../reader/search';
export function HighlightQuery({query,text}:{query:string;text:string}) {
 const matches=matchString(text,query);
 return <span className="search-highlight">{matches.map((entry,index)=><span key={index} className={entry.match?'search-match':undefined}>{entry.text}</span>)}</span>;
}

interface TextMatch {
    text: string;
    match?: string;
}

function matchString(text: string, query: string): TextMatch[] {
    const words = splitQuery(query);
    const initialParts = [{ text }];

    return words.reduce((parts, word) => matchWordInParts(parts, word), initialParts);
}

function matchWordInParts(parts: TextMatch[], word: string): TextMatch[] {
    return parts.reduce((result, part) => {
        if (part.match) {
            result.push(part);
            return result;
        }

        const { text } = part;
        const index = foldSearchText(text).indexOf(word);
        if (index >= 0) {
            const before = text.slice(0, index);
            const inner = text.slice(index, index + word.length);
            const after = text.slice(index + word.length);

            if (before.length > 0) result.push({ text: before });
            if (inner.length > 0) result.push({ text: inner, match: word });
            if (after.length > 0) result.push({ text: after });

            return result;
        }

        result.push({ text });
        return result;
    }, [] as TextMatch[]);
}

function splitQuery(text: string): string[] {
    return foldSearchText(text).split(/\s+/).filter(Boolean);
}
