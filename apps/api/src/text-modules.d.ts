// Markdown files are bundled as text (wrangler.jsonc → rules).
declare module "*.md" {
  const content: string;
  export default content;
}
