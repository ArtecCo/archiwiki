import React, { forwardRef, useEffect, useImperativeHandle } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { TableKit } from "@tiptap/extension-table";
import "./MarkdownEditor.css";

const MarkdownEditor = forwardRef(function MarkdownEditor(
  { value = "", onChange, className = "", style = {}, editable = true },
  ref
) {
  const editor = useEditor({
    editable,
    extensions: [
      StarterKit,
      TableKit.configure({ table: { resizable: false } }),
      Markdown.configure({ markedOptions: { gfm: true, breaks: true } })
    ],
    content: value || "",
    contentType: "markdown",
    onUpdate: ({ editor: instance }) => onChange?.(instance.getMarkdown()),
    editorProps: {
      attributes: {
        class: "archiwiki-markdown-editor-content focus:outline-none",
        spellcheck: "true"
      }
    }
  });

  useImperativeHandle(ref, () => ({
    focus: () => editor?.commands.focus(),
    getMarkdown: () => editor?.getMarkdown() || "",
    insertMarkdown: (markdown) => editor?.chain().focus().insertContent(markdown, { contentType: "markdown" }).run(),
    insertTable: (rows, columns, includeHeader = true) => editor?.chain().focus().insertTable({ rows, cols: columns, withHeaderRow: includeHeader }).run(),
    toggleBold: () => editor?.chain().focus().toggleBold().run(),
    toggleItalic: () => editor?.chain().focus().toggleItalic().run(),
    toggleHeading: (level = 2) => editor?.chain().focus().toggleHeading({ level }).run(),
    toggleBulletList: () => editor?.chain().focus().toggleBulletList().run(),
    toggleOrderedList: () => editor?.chain().focus().toggleOrderedList().run(),
    toggleBlockquote: () => editor?.chain().focus().toggleBlockquote().run(),
    toggleCode: () => editor?.chain().focus().toggleCode().run(),
    setLink: (url) => {
      if (!editor) return;
      const href = String(url || "").trim();
      if (!href) return;
      editor.chain().focus().setLink({ href }).run();
    }
  }), [editor]);

  useEffect(() => {
    if (!editor) return;
    const current = editor.getMarkdown();
    if (value !== current) {
      editor.commands.setContent(value || "", { contentType: "markdown" });
    }
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(Boolean(editable));
  }, [editable, editor]);

  if (!editor) return null;

  return (
    <div className={`archiwiki-markdown-editor ${className}`} style={style}>
      <EditorContent editor={editor} />
    </div>
  );
});

export default MarkdownEditor;
