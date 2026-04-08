"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, X, Loader2, ArrowLeft, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";

const fallbackSubjects = [
  "Anatomia",
  "Fisiologia",
  "Farmacologia",
  "Patologia",
  "Bioquímica",
  "Microbiologia",
];

interface ParsedQuestion {
  order: number;
  text: string;
  options: { label: string; text: string; isCorrect: boolean }[];
  explanation?: string;
  hasImage: boolean;
}

interface ParseResult {
  questions: ParsedQuestion[];
  count: number;
  areas: string[];
}

export default function UploadPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [subjects, setSubjects] = useState<string[]>(fallbackSubjects);

  useEffect(() => {
    async function fetchSubjects() {
      const { data, error } = await supabase
        .from("areas_conhecimento")
        .select("name")
        .order("name");

      if (!error && data && data.length > 0) {
        setSubjects(data.map((row: { name: string }) => row.name));
      }
    }
    fetchSubjects();
  }, [supabase]);

  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [subject, setSubject] = useState("");
  const [bankName, setBankName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === "application/pdf") {
      setFile(droppedFile);
      setPastedText("");
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPastedText("");
    }
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  /** Tenta extrair JSON de uma Response; se falhar, retorna erro legível */
  const safeJson = async (res: Response): Promise<Record<string, unknown>> => {
    const contentType = res.headers.get("content-type");
    if (contentType && !contentType.includes("application/json")) {
      const text = await res.text();
      throw new Error(
        `O servidor retornou uma resposta inesperada (${contentType}): ${text.length > 200 ? text.slice(0, 200) + "..." : text}`
      );
    }
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(
        `Erro ao interpretar resposta do servidor: ${text.length > 200 ? text.slice(0, 200) + "..." : text}`
      );
    }
  };

  const [extractedImages, setExtractedImages] = useState<{ page: number; dataUrl: string }[]>([]);

  /** Extrai texto e imagens de um PDF no browser usando pdf-parse (pdfjs-dist) */
  const extractTextFromPdf = async (pdfFile: File): Promise<{ text: string; images: { page: number; dataUrl: string }[] }> => {
    const { PDFParse } = await import("pdf-parse");
    // Configura o worker do pdfjs-dist (necessário no browser)
    PDFParse.setWorker("/pdf.worker.mjs");
    const arrayBuffer = await pdfFile.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    const parser = new PDFParse({ data: uint8 });
    const textResult = await parser.getText();

    // Extract images
    let images: { page: number; dataUrl: string }[] = [];
    try {
      const imageResult = await (parser as any).getImage({ imageDataUrl: true });
      if (imageResult?.pages) {
        for (const pageImages of imageResult.pages) {
          for (const img of pageImages.images ?? []) {
            if (img.dataUrl) {
              images.push({ page: pageImages.page, dataUrl: img.dataUrl });
            }
          }
        }
      }
    } catch {
      // Image extraction failed - continue without images
      console.warn("Could not extract images from PDF");
    }

    await parser.destroy();
    return { text: textResult.text, images };
  };

  /** OCR client-side para PDFs escaneados usando pdfjs-dist + Tesseract.js */
  const performOCR = async (pdfFile: File): Promise<string> => {
    setError(null);

    // Importar pdfjs-dist para renderizar páginas como imagens
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";

    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

    // Importar Tesseract.js
    const Tesseract = await import("tesseract.js");

    const allText: string[] = [];
    const totalPages = pdf.numPages;

    // Processar páginas em lotes de 5 para não sobrecarregar
    for (let i = 1; i <= totalPages; i++) {
      setError(null);
      setSaveProgress(`OCR: processando página ${i}/${totalPages}...`);

      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 }); // 2x para melhor OCR

      // Renderizar página em canvas
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;

      // Converter canvas para imagem e fazer OCR
      const imageData = canvas.toDataURL("image/png");
      const { data } = await Tesseract.default.recognize(imageData, "por", {
        logger: () => {}, // Silencia logs do Tesseract
      });

      if (data.text.trim()) {
        allText.push(data.text);
      }

      // Limpar canvas
      canvas.remove();
    }

    setSaveProgress("");
    return allText.join("\n\n");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    setParseResult(null);

    try {
      let textToParse: string;

      if (file) {
        // Carregar PDF com pdfjs-dist uma única vez
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

        // Tentar extrair texto das primeiras 3 páginas para decidir se precisa OCR
        let sampleText = "";
        const samplPages = Math.min(3, pdf.numPages);
        for (let i = 1; i <= samplPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          sampleText += content.items.map((item: any) => item.str).join(" ");
        }

        const meaningfulSample = sampleText.replace(/--\s*\d+\s*of\s*\d+\s*--/g, "").replace(/\s+/g, "").trim();

        if (meaningfulSample.length > 50) {
          // PDF com texto — extrair normalmente
          try {
            const pdfResult = await extractTextFromPdf(file);
            textToParse = pdfResult.text;
            setExtractedImages(pdfResult.images);
          } catch (pdfErr) {
            console.error("Erro ao extrair texto:", pdfErr);
            throw new Error("Não foi possível extrair texto do PDF.");
          }
        } else {
          // PDF escaneado — OCR direto usando o pdf já carregado
          setSaveProgress("PDF escaneado detectado. Iniciando OCR...");
          try {
            const Tesseract = await import("tesseract.js");
            const allText: string[] = [];
            const totalPages = pdf.numPages;

            for (let i = 1; i <= totalPages; i++) {
              setSaveProgress(`OCR: página ${i}/${totalPages}...`);

              const page = await pdf.getPage(i);
              const viewport = page.getViewport({ scale: 1.5 });
              const canvas = document.createElement("canvas");
              canvas.width = viewport.width;
              canvas.height = viewport.height;
              const ctx = canvas.getContext("2d")!;
              await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;

              const imageData = canvas.toDataURL("image/jpeg", 0.8);
              const { data } = await Tesseract.default.recognize(imageData, "por", {
                logger: () => {},
              });

              if (data.text.trim()) {
                allText.push(data.text);
              }
              canvas.remove();
            }

            textToParse = allText.join("\n\n");
            setSaveProgress("");
          } catch (ocrErr) {
            console.error("Erro no OCR:", ocrErr);
            setSaveProgress("");
            throw new Error("OCR falhou. Tente colar o texto manualmente.");
          }

          if (!textToParse.trim()) {
            throw new Error("OCR não extraiu texto legível. Tente colar o texto manualmente.");
          }
        }
      } else if (pastedText.trim()) {
        textToParse = pastedText.trim();
      } else {
        throw new Error("Selecione um arquivo PDF ou cole o texto");
      }

      // Parse the text to extract questions
      const parseRes = await fetch("/api/pdf/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToParse }),
      });

      if (!parseRes.ok) {
        const parseErr = await safeJson(parseRes);
        throw new Error((parseErr.error as string) || "Erro ao processar texto");
      }

      const result = (await safeJson(parseRes)) as unknown as ParseResult;
      setParseResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setIsLoading(false);
    }
  };

  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState("");
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());

  const toggleQuestion = (order: number) => {
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(order)) {
        next.delete(order);
      } else {
        next.add(order);
      }
      return next;
    });
  };

  const expandAll = () => {
    if (!parseResult) return;
    setExpandedQuestions(new Set(parseResult.questions.map((q) => q.order)));
  };

  const collapseAll = () => {
    setExpandedQuestions(new Set());
  };

  const handleSave = async () => {
    if (!parseResult || parseResult.count === 0) return;

    setSaving(true);
    setError(null);
    setSaveProgress("");

    try {
      const BATCH_SIZE = 50;
      const allQuestions = parseResult.questions;
      const totalBatches = Math.ceil(allQuestions.length / BATCH_SIZE);

      for (let i = 0; i < totalBatches; i++) {
        const batch = allQuestions.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        setSaveProgress(`Salvando lote ${i + 1}/${totalBatches}...`);

        // Only include images for questions in this batch that have hasImage=true
        const batchHasImages = batch.some((q) => q.hasImage);
        const imagesToSend = batchHasImages ? extractedImages : [];

        const res = await fetch("/api/pacotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: bankName,
            subject,
            questions: batch,
            images: imagesToSend,
            batchIndex: i,
            totalBatches,
            isFirstBatch: i === 0,
          }),
        });

        const contentType = res.headers.get("content-type");
        if (!res.ok) {
          if (contentType?.includes("application/json")) {
            const err = await safeJson(res);
            throw new Error((err.error as string) || `Erro ao salvar lote ${i + 1}`);
          } else {
            const text = await res.text();
            throw new Error(
              `Erro ao salvar lote ${i + 1}: ${text.length > 200 ? text.slice(0, 200) + "..." : text}`
            );
          }
        }
      }

      alert(`Pacote salvo com sucesso! ${allQuestions.length} questões importadas.`);
      router.push("/bancos");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar pacote");
    } finally {
      setSaving(false);
      setSaveProgress("");
    }
  };

  const handleBack = () => {
    setParseResult(null);
    setError(null);
  };

  // ---- Result view (after parsing) ----
  if (parseResult) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Questões Extraídas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>
                <strong>{parseResult.count}</strong> questões encontradas
              </span>
              {parseResult.areas.length > 0 && (
                <span>
                  Áreas: {parseResult.areas.join(", ")}
                </span>
              )}
            </div>

            {/* Expand/Collapse all */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={expandAll}>
                Expandir tudo
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll}>
                Recolher tudo
              </Button>
            </div>

            {/* Questions list */}
            <div className="space-y-3">
              {parseResult.questions.map((q) => {
                const isExpanded = expandedQuestions.has(q.order);
                return (
                  <div
                    key={q.order}
                    className="rounded-lg border border-border bg-muted/20 p-4"
                  >
                    <div
                      className="flex cursor-pointer items-start justify-between gap-3"
                      onClick={() => toggleQuestion(q.order)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                            {q.order}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {q.options.length} opções
                          </span>
                          {q.hasImage && (
                            <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-xs text-yellow-700">
                              Imagem
                            </span>
                          )}
                        </div>
                        {isExpanded ? (
                          <div className="space-y-2">
                            <p className="whitespace-pre-wrap text-sm text-foreground">
                              {q.text}
                            </p>
                            <div className="space-y-1 pl-2">
                              {q.options.map((opt) => (
                                <p
                                  key={opt.label}
                                  className={`text-sm ${opt.isCorrect ? "font-semibold text-green-700" : "text-muted-foreground"}`}
                                >
                                  {opt.label}) {opt.text}
                                  {opt.isCorrect && " \u2713"}
                                </p>
                              ))}
                            </div>
                            {q.explanation && (
                              <p className="mt-1 rounded bg-blue-50 p-2 text-xs text-blue-800">
                                <strong>Explicação:</strong> {q.explanation}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-foreground">
                            {q.text.length > 150
                              ? q.text.slice(0, 150) + "..."
                              : q.text}
                          </p>
                        )}
                      </div>
                      <span className="mt-1 shrink-0 transition-transform">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {parseResult.count === 0 && (
              <p className="text-center text-sm text-muted-foreground">
                Nenhuma questão detectada no texto. Verifique a formatação do PDF.
              </p>
            )}

            {/* Error message */}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
              <Button
                onClick={handleSave}
                disabled={parseResult.count === 0 || saving}
                className="flex-1"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {saveProgress || "Salvando..."}
                  </>
                ) : (
                  "Salvar Pacote"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Upload form view ----
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload de PDF</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Drag & Drop zone */}
            <div>
              <Label className="mb-2 block">Arquivo PDF</Label>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                }`}
              >
                <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">
                  Arraste e solte o PDF aqui
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  ou clique para selecionar
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            </div>

            {/* File preview */}
            {file && (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={removeFile}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  ou
                </span>
              </div>
            </div>

            {/* Paste text area */}
            <div>
              <Label htmlFor="pastedText" className="mb-2 block">
                Colar texto do PDF
              </Label>
              <textarea
                id="pastedText"
                placeholder="Cole aqui o texto extraído do PDF..."
                value={pastedText}
                onChange={(e) => {
                  setPastedText(e.target.value);
                  if (e.target.value.trim()) {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }
                }}
                rows={6}
                className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              />
            </div>

            {/* Subject select */}
            <div>
              <Label htmlFor="subject" className="mb-2 block">
                Matéria
              </Label>
              <select
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <option value="">Selecione uma matéria</option>
                {subjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Bank name */}
            <div>
              <Label htmlFor="bankName" className="mb-2 block">
                Nome do Banco de Questões
              </Label>
              <Input
                id="bankName"
                placeholder="Ex: Prova de Anatomia 2024.1"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
            </div>

            {/* Error message */}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={(!file && !pastedText.trim()) || !subject || !bankName || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Enviar e Processar
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
