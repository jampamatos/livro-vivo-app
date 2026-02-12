declare namespace renderer {
  type ReactTestRenderer = any;
  type ReactTestInstance = any;

  function create(...args: any[]): ReactTestRenderer;
  function act(callback: () => void | Promise<void>): void | Promise<void>;
}

declare module "react-test-renderer" {
  export = renderer;
}
