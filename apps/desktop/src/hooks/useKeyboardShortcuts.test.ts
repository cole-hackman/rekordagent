import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";

afterEach(() => {
  document.body.replaceChildren();
});

function dispatchKey(key: string, target: EventTarget = document.body) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true });
  Object.defineProperty(event, "target", { value: target });
  window.dispatchEvent(event);
}

describe("useKeyboardShortcuts", () => {
  it("fires when key matches and target is body", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: " ", handler }]));
    act(() => dispatchKey(" "));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("does not fire when target is an input", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: " ", handler }]));
    const input = document.createElement("input");
    document.body.appendChild(input);
    act(() => dispatchKey(" ", input));
    expect(handler).not.toHaveBeenCalled();
  });

  it("does not fire when target is a button (so space activates the button)", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: " ", handler }]));
    const button = document.createElement("button");
    document.body.appendChild(button);
    act(() => dispatchKey(" ", button));
    expect(handler).not.toHaveBeenCalled();
  });

  it("does not fire when target is a link", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: " ", handler }]));
    const link = document.createElement("a");
    document.body.appendChild(link);
    act(() => dispatchKey(" ", link));
    expect(handler).not.toHaveBeenCalled();
  });

  it("does not fire when target has role=button", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: " ", handler }]));
    const div = document.createElement("div");
    div.setAttribute("role", "button");
    document.body.appendChild(div);
    act(() => dispatchKey(" ", div));
    expect(handler).not.toHaveBeenCalled();
  });

  it("escape still fires inside an input", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: "escape", handler }]));
    const input = document.createElement("input");
    document.body.appendChild(input);
    act(() => dispatchKey("Escape", input));
    expect(handler).toHaveBeenCalledOnce();
  });
});
