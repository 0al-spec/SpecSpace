import { useCallback, useMemo, useState } from "react";
import type { Node } from "@xyflow/react";
import { useNavHistory } from "./useNavHistory";
import { useSessionString } from "./useSessionState";
import type { ApiSpecNode } from "./types";

interface UseSelectionStateOptions {
  graphNodes: Node[];
  specNodes: ApiSpecNode[] | undefined;
  panToNode: (nodeId: string, delay?: number, keepZoom?: boolean) => void;
}

export function useSelectionState({
  graphNodes,
  specNodes,
  panToNode,
}: UseSelectionStateOptions) {
  const [selectedConversationId, setSelectedConversationId] =
    useSessionString("selected_conversation");
  const [selectedMessageId, setSelectedMessageId] =
    useSessionString("selected_message");
  const [selectedSubItemId, setSelectedSubItemId] = useState<string | null>(null);
  const [lensNodeId, setLensNodeId] = useState<string | null>(null);
  const [compileTargetConversationId, setCompileTargetConversationId] =
    useSessionString("compile_target_conversation_id");
  const [compileTargetMessageId, setCompileTargetMessageId] =
    useSessionString("compile_target_message_id");

  const specNav = useNavHistory<string>();

  const setCompileTarget = useCallback(
    (convId: string | null, msgId: string | null) => {
      setCompileTargetConversationId(convId);
      setCompileTargetMessageId(msgId);
    },
    [setCompileTargetConversationId, setCompileTargetMessageId],
  );

  const navigateToSpec = useCallback(
    (nodeId: string, { addToHistory = true } = {}) => {
      if (addToHistory) specNav.push(nodeId);
      setSelectedConversationId(nodeId);
      setSelectedMessageId(null);
      setSelectedSubItemId(null);
      panToNode(nodeId, 50);
    },
    [specNav.push, setSelectedConversationId, setSelectedMessageId, panToNode],
  );

  const onFocusNode = useCallback(
    (nodeId: string) => {
      navigateToSpec(nodeId);
    },
    [navigateToSpec],
  );

  const onSpecNavBack = useCallback(() => {
    const id = specNav.back();
    if (!id) return;
    setSelectedConversationId(id);
    setSelectedMessageId(null);
    setSelectedSubItemId(null);
    panToNode(id, 50);
  }, [specNav, setSelectedConversationId, setSelectedMessageId, panToNode]);

  const onSpecNavForward = useCallback(() => {
    const id = specNav.forward();
    if (!id) return;
    setSelectedConversationId(id);
    setSelectedMessageId(null);
    setSelectedSubItemId(null);
    panToNode(id, 50);
  }, [specNav, setSelectedConversationId, setSelectedMessageId, panToNode]);

  const onConversationFileSelect = useCallback(
    (fileName: string) => {
      const node = graphNodes.find(
        (n) => !n.parentId && (n.data as { fileName?: string }).fileName === fileName,
      );
      if (!node) return;
      setSelectedConversationId(node.id);
      setSelectedMessageId(null);
      panToNode(node.id, 50);
    },
    [graphNodes, setSelectedConversationId, setSelectedMessageId, panToNode],
  );

  const dismissInspector = useCallback(() => {
    setSelectedConversationId(null);
    setSelectedMessageId(null);
    setSelectedSubItemId(null);
  }, [setSelectedConversationId, setSelectedMessageId]);

  const specNavLabel = useCallback(
    (id: string | null) => {
      if (!id) return "";
      const node = specNodes?.find((n) => n.node_id === id);
      return node ? `${id} — ${node.title}` : id;
    },
    [specNodes],
  );

  const specNavLabels = useMemo(
    () => ({
      back: specNavLabel(specNav.peek(-1)),
      forward: specNavLabel(specNav.peek(+1)),
    }),
    [specNav, specNavLabel],
  );

  return {
    selectedConversationId,
    setSelectedConversationId,
    selectedMessageId,
    setSelectedMessageId,
    selectedSubItemId,
    setSelectedSubItemId,
    lensNodeId,
    setLensNodeId,
    compileTargetConversationId,
    compileTargetMessageId,
    setCompileTarget,
    specNav,
    navigateToSpec,
    onSpecNodeSelect: navigateToSpec,
    onFocusNode,
    onSpecNavBack,
    onSpecNavForward,
    onConversationFileSelect,
    dismissInspector,
    specNavBackLabel: specNavLabels.back,
    specNavForwardLabel: specNavLabels.forward,
  };
}
