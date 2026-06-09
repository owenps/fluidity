import { invoke } from "@tauri-apps/api/core";
import type {
  CodeFileReadRequest,
  CodeFileReadResponse,
  CodeFileStatRequest,
  CodeFileStatResponse,
  CodeFileWriteRequest,
  CodeFileWriteResponse,
} from "./types";

export function readCodeFile(request: CodeFileReadRequest): Promise<CodeFileReadResponse> {
  return invoke<CodeFileReadResponse>("code_file_read", { request });
}

export function writeCodeFile(request: CodeFileWriteRequest): Promise<CodeFileWriteResponse> {
  return invoke<CodeFileWriteResponse>("code_file_write", { request });
}

export function statCodeFile(request: CodeFileStatRequest): Promise<CodeFileStatResponse> {
  return invoke<CodeFileStatResponse>("code_file_stat", { request });
}
