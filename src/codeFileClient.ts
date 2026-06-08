import { invoke } from "@tauri-apps/api/core";
import type {
  CodeFileReadRequest,
  CodeFileReadResponse,
  CodeFileWriteRequest,
  CodeFileWriteResponse,
} from "./types";

export function readCodeFile(request: CodeFileReadRequest): Promise<CodeFileReadResponse> {
  return invoke<CodeFileReadResponse>("code_file_read", { request });
}

export function writeCodeFile(request: CodeFileWriteRequest): Promise<CodeFileWriteResponse> {
  return invoke<CodeFileWriteResponse>("code_file_write", { request });
}
