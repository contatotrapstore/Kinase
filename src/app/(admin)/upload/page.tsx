"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, X, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";

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
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(text.length > 200 ? text.slice(0, 200) + "..." : text);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    setParseResult(null);

    try {
      let textToParse: string;

      if (file) {
        // Extrai texto e imagens do PDF diretamente no browser (sem limite de tamanho)
        try {
          const pdfResult = await extractTextFromPdf(file);
          textToParse = pdfResult.text;
          setExtractedImages(pdfResult.images);
        } catch (pdfErr) {
          console.error("Erro ao extrair texto do PDF:", pdfErr);
          throw new Error(
            "Não foi possível extrair texto do PDF. Verifique se o arquivo é um PDF válido ou cole o texto manualmente."
          );
        }

        if (!textToParse.trim()) {
          throw new Error(
            "O PDF não contém texto extraível (pode ser um PDF de imagens). Cole o texto manualmente no campo abaixo."
          );
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

  const handleSave = async () => {
    if (!parseResult || parseResult.count === 0) return;

    setSaving(true);
    setError(null);

    try {
      // Only include images for questions that have hasImage=true
      const questionsWithImages = parseResult.questions.filter((q) => q.hasImage);
      const imagesToSend = questionsWithImages.length > 0 ? extractedImages : [];

      const res = await fetch("/api/pacotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: bankName,
          subject,
          questions: parseResult.questions,
          images: imagesToSend,
        }),
      });

      if (!res.ok) {
        const err = await safeJson(res);
        throw new Error((err.error as string) || "Erro ao salvar pacote");
      }

      router.push("/bancos");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar pacote");
    } finally {
      setSaving(false);
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

            {/* Questions list */}
            <div className="space-y-3">
              {parseResult.questions.map((q) => (
                <div
                  key={q.order}
                  className="rounded-lg border border-border bg-muted/20 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
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
                      <p className="text-sm text-foreground">
                        {q.text.length > 100
                          ? q.text.slice(0, 100) + "..."
                          : q.text}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
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
                    Salvando...
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
