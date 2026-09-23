import { Node, mergeAttributes } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { ReactNodeViewRenderer } from "@tiptap/react";
import type { DocumentFieldAttrs } from "@/schemas/document-content";
import { TemplateFieldChip } from "@/components/docs/TemplateFieldChip";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    templateField: {
      insertTemplateField: (attrs: DocumentFieldAttrs) => ReturnType;
      updateTemplateField: (attrs: Partial<DocumentFieldAttrs>) => ReturnType;
    };
  }
}

export const TemplateFieldExtension = Node.create({
  name: "templateField",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      fieldId: { default: null },
      type: { default: "TEXT" },
      label: { default: "" },
      required: { default: true },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-template-field]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-template-field": "",
        class: "template-field-chip",
      }),
    ];
  },

  addCommands() {
    return {
      insertTemplateField:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs,
          }),
      updateTemplateField:
        (attrs) =>
        ({ tr, state, dispatch }) => {
          const { selection } = state;
          if (!(selection instanceof NodeSelection) || selection.node.type.name !== this.name) {
            return false;
          }
          if (dispatch) {
            tr.setNodeMarkup(selection.from, undefined, {
              ...selection.node.attrs,
              ...attrs,
            });
            dispatch(tr);
          }
          return true;
        },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(TemplateFieldChip);
  },
});
