import { useEffect, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import CharacterCount from "@tiptap/extension-character-count";
import Image from "@tiptap/extension-image";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link2,
  ImagePlus,
  Undo2,
  Redo2,
  RemoveFormatting,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { MediaPicker } from "@/components/media-picker";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function ToolbarButton({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={cn("size-8 text-muted-foreground hover:text-foreground", active && "bg-muted text-foreground")}
    >
      {children}
    </Button>
  );
}

function LinkButton({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const apply = () => {
    const href = url.trim();
    const chain = editor.chain().focus().extendMarkRange("link");
    if (!href) chain.unsetLink().run();
    else chain.setLink({ href: /^(https?:|mailto:|tel:|\/|#)/.test(href) ? href : `https://${href}` }).run();
    setOpen(false);
  };
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (o) setUrl((editor.getAttributes("link").href as string | undefined) ?? "");
        setOpen(o);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Link"
          title="Link"
          aria-pressed={editor.isActive("link")}
          className={cn("size-8 text-muted-foreground hover:text-foreground", editor.isActive("link") && "bg-muted text-foreground")}
        >
          <Link2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-2">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            apply();
          }}
        >
          <Input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste a link…" className="h-8" />
          <Button type="submit" size="sm">
            {url.trim() ? "Apply" : "Remove"}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function Toolbar({ editor, sticky }: { editor: Editor; sticky?: string }) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div
      className={cn(
        "z-[5] flex flex-wrap items-center gap-0.5 border-b bg-background/95 p-1 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        sticky && "sticky",
      )}
      style={sticky ? { top: sticky } : undefined}
    >
      <ToolbarButton label="Undo" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
        <Undo2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Redo" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
        <Redo2 className="h-4 w-4" />
      </ToolbarButton>
      <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-5" />
      <ToolbarButton label="Heading 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <Heading1 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>
      <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-5" />
      <ToolbarButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Inline code" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}>
        <Code className="h-4 w-4" />
      </ToolbarButton>
      <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-5" />
      <ToolbarButton label="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote className="h-4 w-4" />
      </ToolbarButton>
      <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-5" />
      <ToolbarButton label="Align left" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
        <AlignLeft className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Align center" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
        <AlignCenter className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Align right" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
        <AlignRight className="h-4 w-4" />
      </ToolbarButton>
      <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-5" />
      <LinkButton editor={editor} />
      <ToolbarButton label="Insert image" onClick={() => setPickerOpen(true)}>
        <ImagePlus className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
        <RemoveFormatting className="h-4 w-4" />
      </ToolbarButton>

      <MediaPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        multiple={false}
        confirmLabel="Insert"
        onSelect={(media) => editor.chain().focus().setImage({ src: media.url, alt: media.alt ?? undefined }).run()}
      />
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = 320,
  className,
  variant = "field",
  stickyToolbar,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  className?: string;
  /** "document" drops the outer frame for full-page editors. */
  variant?: "field" | "document";
  /** CSS `top` for a toolbar that sticks while the page scrolls. */
  stickyToolbar?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    // Keeps toolbar active states in step with the selection.
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true },
      }),
      Placeholder.configure({ placeholder: placeholder ?? "Start writing…" }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      CharacterCount,
      Image.configure({ HTMLAttributes: { class: "rounded-xl max-w-full h-auto" } }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div
      className={cn(
        variant === "field"
          ? "rounded-lg border shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50"
          : "rounded-lg border",
        !stickyToolbar && "overflow-hidden",
        className,
      )}
    >
      <Toolbar editor={editor} sticky={stickyToolbar} />
      <EditorContent
        editor={editor}
        style={{ minHeight }}
        className={cn("rich-text", variant === "document" ? "px-6 py-5 text-[15px] md:px-10 md:py-8" : "px-4 py-3 text-sm")}
      />
      <div className="border-t px-3 py-1.5 text-right text-xs text-muted-foreground tabular-nums">
        {editor.storage.characterCount.words()} words · {editor.storage.characterCount.characters()} characters
      </div>
    </div>
  );
}

export function RichTextField<T extends FieldValues>({
  control,
  name,
  placeholder,
  minHeight,
}: {
  control: Control<T>;
  name: Path<T>;
  placeholder?: string;
  minHeight?: number;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <RichTextEditor value={(field.value as string) ?? ""} onChange={field.onChange} placeholder={placeholder} minHeight={minHeight} />
      )}
    />
  );
}
