# @netherstone/nethermark-react

## 0.3.0

### Patch Changes

- Updated dependencies [1f25988]
- Updated dependencies [320bf52]
  - @netherstone/nethermark@0.3.0

## 0.2.0

### Minor Changes

- 0e577e9: Adds `@netherstone/nethermark-react`, a React component for the editor, on React 18 and 19. `<MarkdownEditor>` takes `value` and `onChange`, or `defaultValue`, and every editor option. It never sets its own edit back on itself, so typing keeps the cursor and undo history, and it only copies the doc out when there's an `onChange`. `theme`, `readOnly`, `shortcuts`, `labels`, `icons` and `ariaLabel` change in place, and a change to any other option builds the editor again, keeping the doc, the selection and focus. `onPaste` and `onDrop` can change any time. Strict Mode's second mount is fine. The ref is the editor's handle.
  
  `<Preview>` from `@netherstone/nethermark-react/preview` adds the preview inside `<MarkdownEditor>`, and its toggle to the default toolbar. `useEditorEffect` and `useToolbarItems` are for a host's own add-ons.

### Patch Changes

- Updated dependencies [b7a8a1c]
- Updated dependencies [310358d]
- Updated dependencies [5f0512a]
- Updated dependencies [3c70b1c]
- Updated dependencies [e0ce24f]
  - @netherstone/nethermark@0.2.0
