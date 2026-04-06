import React from "react";

import { attachAttributedCopyListener } from "../src/hooks/useAttributedCopy";

type CopyEvent = {
  clipboardData: { setData: jest.Mock };
  preventDefault: jest.Mock;
};

describe("attachAttributedCopyListener", () => {
  it("anexa a citação ao copiar texto dentro do container", () => {
    const setData = jest.fn();
    const preventDefault = jest.fn();
    const selection = {
      rangeCount: 1,
      isCollapsed: false,
      anchorNode: { id: "inside" },
      focusNode: { id: "inside" },
      toString: () => "Trecho selecionado",
      getRangeAt: () => ({
        cloneContents: () => ({ html: "<strong>Trecho selecionado</strong>" }),
      }),
    };
    let handler: ((event: CopyEvent) => void) | null = null;
    const doc = {
      addEventListener: (_type: string, listener: ((event: CopyEvent) => void)) => {
        handler = listener;
      },
      removeEventListener: jest.fn(),
      createElement: () => ({
        innerHTML: "",
        appendChild(node: unknown) {
          const htmlNode = node as { html?: string };
          this.innerHTML = htmlNode.html || "";
        },
      }),
    };
    const containerRef = {
      current: {
        contains: () => true,
      },
    } as React.RefObject<{ contains: (node: unknown) => boolean } | null>;

    const cleanup = attachAttributedCopyListener({
      enabled: true,
      citation: "AUTOR. Referência.",
      containerRef,
      win: { getSelection: () => selection },
      doc,
    });

    expect(handler).not.toBeNull();
    if (!handler) {
      throw new Error("Copy listener was not registered");
    }
    const registeredHandler = handler as (event: CopyEvent) => void;
    registeredHandler({ clipboardData: { setData }, preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(setData).toHaveBeenCalledWith(
      "text/plain",
      "Trecho selecionado\n\nAUTOR. Referência."
    );
    expect(setData).toHaveBeenCalledWith(
      "text/html",
      "<strong>Trecho selecionado</strong><p><br></p><p>AUTOR. Referência.</p>"
    );

    cleanup();
    expect(doc.removeEventListener).toHaveBeenCalled();
  });

  it("ignora cópia quando a seleção não pertence ao container", () => {
    const setData = jest.fn();
    let handler: ((event: CopyEvent) => void) | null = null;
    const doc = {
      addEventListener: (_type: string, listener: ((event: CopyEvent) => void)) => {
        handler = listener;
      },
      removeEventListener: jest.fn(),
      createElement: () => ({
        innerHTML: "",
        appendChild() {},
      }),
    };

    attachAttributedCopyListener({
      enabled: true,
      citation: "AUTOR. Referência.",
      containerRef: {
        current: {
          contains: () => false,
        },
      } as React.RefObject<{ contains: (node: unknown) => boolean } | null>,
      win: {
        getSelection: () => ({
          rangeCount: 1,
          isCollapsed: false,
          anchorNode: { id: "outside" },
          focusNode: { id: "outside" },
          toString: () => "Trecho",
          getRangeAt: () => ({
            cloneContents: () => ({ html: "Trecho" }),
          }),
        }),
      },
      doc,
    });

    if (!handler) {
      throw new Error("Copy listener was not registered");
    }
    const registeredHandler = handler as (event: CopyEvent) => void;
    registeredHandler({ clipboardData: { setData }, preventDefault: jest.fn() });
    expect(setData).not.toHaveBeenCalled();
  });
});
