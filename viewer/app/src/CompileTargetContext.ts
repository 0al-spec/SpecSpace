import { createContext } from "react";

export interface CompileTargetState {
  compileTargetConversationId: string | null;
  compileTargetMessageId: string | null;
}

export const CompileTargetContext = createContext<CompileTargetState>({
  compileTargetConversationId: null,
  compileTargetMessageId: null,
});
