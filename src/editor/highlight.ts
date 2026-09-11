/** Only imported by editor/code readers, with grammars loaded on demand. No network requests to a service. */
let highlighter:ReturnType<typeof create> | undefined;
async function create(){const {createHighlighter}=await import('shiki/bundle/web');return createHighlighter({themes:['github-light','github-dark'],langs:[]});}
export function codeHighlighter(){return highlighter??=create();}
