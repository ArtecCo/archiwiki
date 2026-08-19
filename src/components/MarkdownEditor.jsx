import React, {
  useEffect,
  useImperativeHandle,
  useRef,
  forwardRef
} from "react";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { TableKit } from "@tiptap/extension-table";

const MarkdownEditor = forwardRef(function MarkdownEditor(
  {
    value = "",
    onChange,
    placeholder = "Write your thoughts...",
    className = "",
    style = {},
    theme = "beige",
    editable = true
  },
  ref
) {
  const lastValueRef = useRef(value);

  const editor = useEditor({
    editable,

    extensions: [
      StarterKit,

      TableKit.configure({
        table: {
          resizable: false
        }
      }),

      Markdown.configure({
        markedOptions: {
          gfm: true,
          breaks: true
        }
      })
    ],

    content: value,
    contentType: "markdown",

    onUpdate: ({ editor }) => {
      const markdown = editor.getMarkdown();

      lastValueRef.current = markdown;

      onChange?.(markdown);
    },

    editorProps: {
      attributes: {
        class:
          "archiwiki-markdown-editor-content focus:outline-none"
      }
    }
  });

  /*
   * Allow the parent Editor.jsx to interact with the
   * Tiptap editor.
   */
  useImperativeHandle(ref, () => ({
    focus() {
      editor?.commands.focus();
    },

    getMarkdown() {
      return editor?.getMarkdown() || "";
    },

    insertMarkdown(markdown) {
      if (!editor) return;

      editor
        .chain()
        .focus()
        .insertContent(markdown, {
          contentType: "markdown"
        })
        .run();
    },

    insertTable(rows, columns, includeHeader = true) {
      if (!editor) return;

      editor
        .chain()
        .focus()
        .insertTable({
          rows,
          cols: columns,
          withHeaderRow: includeHeader
        })
        .run();
    },

    isActive(name, attributes = {}) {
      return editor?.isActive(name, attributes) || false;
    },

    toggleBold() {
      editor?.chain().focus().toggleBold().run();
    },

    toggleItalic() {
      editor?.chain().focus().toggleItalic().run();
    },

    toggleHeading(level = 2) {
      editor
        ?.chain()
        .focus()
        .toggleHeading({ level })
        .run();
    },

    toggleBulletList() {
      editor?.chain().focus().toggleBulletList().run();
    },

    toggleOrderedList() {
      editor?.chain().focus().toggleOrderedList().run();
    },

    toggleBlockquote() {
      editor?.chain().focus().toggleBlockquote().run();
    },

    toggleCode() {
      editor?.chain().focus().toggleCode().run();
    },

    setLink(url) {
      if (!editor) return;

      editor
        .chain()
        .focus()
        .setLink({ href: url })
        .run();
    }
  }));

  /*
   * When ArchiWiki loads a different note, replace the editor
   * contents with that note's Markdown.
   */
  useEffect(() => {
    if (!editor) return;

    const current = editor.getMarkdown();

    if (value !== current) {
      editor.commands.setContent(value || "", {
        contentType: "markdown"
      });

      lastValueRef.current = value || "";
    }
  }, [value, editor]);

  useEffect(() => {
    if (!editor) return;

    editor.setEditable(editable);
  }, [editable, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div
      className={`archiwiki-markdown-editor ${className}`}
      style={style}
    >
      <EditorContent editor={editor} />
    </div>
  );
});

export default MarkdownEditor;
