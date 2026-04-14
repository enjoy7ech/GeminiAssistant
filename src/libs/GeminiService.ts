import { GoogleGenAI } from "@google/genai";

export interface ChromaOptions {
  tolerance?: number;
  contiguous?: boolean;
  smoothing?: number;
  targetColor?: { r: number; g: number; b: number };
  erosion?: number;
  feathering?: number;
}

export interface ImageGenerateOptions {
  removeBg?: boolean;
  useGreenScreen?: boolean;
  compressWebp?: boolean;
  webpQuality?: number;
  chromaOptions?: ChromaOptions;
  inputImages?: Array<{
    mimeType: string;
    data: string;
  }>;
}

export class GeminiService {
    private client: any = null;
    private currentModel: string = "";
    private imageModel: string = "";

    constructor(apiKey?: string, modelName: string = "", imageModel: string = "", baseUrl: string = "") {
        if (apiKey) this.initClient(apiKey, modelName, imageModel, baseUrl);
    }

    public initClient(apiKey: string, modelName: string = "", imageModel: string = "", baseUrl: string = "") {
        this.currentModel = modelName; this.imageModel = imageModel;
        if (!apiKey) return;
        this.client = new GoogleGenAI({ 
            apiKey,
            httpOptions: baseUrl ? { baseUrl } : undefined
        });
    }

    public updateTextModel(modelName: string) { this.currentModel = modelName; }
    public updateImageModel(modelName: string) { this.imageModel = modelName; }

    public async listModels() {
        if (!this.client) return [];
        try {
            const response = await this.client.models.list();
            let rawModels = [];
            if (response && typeof response[Symbol.asyncIterator] === 'function') {
                for await (const m of response) rawModels.push(m);
            } else {
                rawModels = Array.isArray(response) ? response : (response?.models || []);
            }
            return rawModels.filter((m: any) => {
                const name = m.name.toLowerCase();
                if (name.includes('tts') || name.includes('embedding') || name.includes('vision') || name.includes('aqa')) return false;
                if (/\d{3}/.test(name)) return false;
                return name.includes('gemini') || name.includes('imagen');
            }).map((m: any) => ({ displayName: m.displayName || m.name.split('/').pop(), name: m.name }));
        } catch (e: any) { 
            throw new Error(`无法获取模型列表: ${e.message}`);
        }
    }

    public async generateText(prompt: string) {
        if (!this.client) return "请配置 API Key";
        try {
            const result = await this.client.models.generateContent({
                model: this.currentModel,
                contents: [{ role: 'user', parts: [{ text: prompt }] }]
            });
            return result.text;
        } catch (e: any) { return `生成失败: ${e.message}`; }
    }

    public async sendMessage(prompt: string, history: any[] = [], cacheName?: string) {
        if (!this.client) return "请配置 API Key";
        try {
            const validHistory = history.filter(item => item.content && item.content.trim() && !item.content.startsWith("消息发送失败:"));
            const formattedHistory = validHistory.map(item => ({ role: item.role, parts: [{ text: item.content }] }));
            const contents = [...formattedHistory, { role: 'user', parts: [{ text: prompt }] }];
            const result = await this.client.models.generateContent({
                model: this.currentModel,
                contents,
                config: cacheName ? { cachedContent: cacheName } : undefined
            });
            return result.candidates?.[0]?.content?.parts?.[0]?.text || result.text || "未返回内容";
        } catch (e: any) { return `消息发送失败: ${e.message}`; }
    }

    public async createCache(displayName: string, contents: any[], systemInstruction?: string, ttlSeconds: number = 3600) {
        if (!this.client) return null;
        try {
            const formattedContents = contents.map(item => ({ role: item.role, parts: [{ text: item.content }] }));
            return await this.client.caches.create({
                model: this.currentModel,
                config: { contents: formattedContents, displayName, systemInstruction, ttl: `${ttlSeconds}s` }
            });
        } catch (e) { throw e; }
    }

    public async deleteCache(cacheName: string) {
        if (!this.client) return;
        try {
            await this.client.caches.delete({ name: cacheName });
        } catch (e) { throw e; }
    }

    public async generateImage(userPrompt: string, options: ImageGenerateOptions = {}) {
        if (!this.client) return { error: "请配置 API Key" };
        let finalPrompt = userPrompt;
        if (options.useGreenScreen) {
            finalPrompt += "。背景必须是 100% 纯绿色 (#00FF00)，严禁环境漫反射。主体与背景边缘必须清晰锐利。";
        }
        try {
            const isImagen = this.imageModel.toLowerCase().includes('imagen');
            let resultData: any;
            if (isImagen) {
                const response = await this.client.models.generateImages({ model: this.imageModel, prompt: finalPrompt, parameters: { number_of_images: 1 } });
                const img = response.images?.[0];
                if (!img) throw new Error("未生成图片");
                resultData = { base64: img.base64, url: `data:image/png;base64,${img.base64}` };
            } else {
                const parts: any[] = [{ text: finalPrompt }];
                if (options.inputImages) options.inputImages.forEach(img => parts.push({ inlineData: img }));
                const result = await this.client.models.generateContent({ model: this.imageModel, contents: [{ role: 'user', parts }] });
                const b64 = result.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData.data;
                if (!b64) throw new Error("未生成图片");
                const url = `data:image/png;base64,${b64}`;
                resultData = { base64: b64, url, originalUrl: url };
            }
            if (options.compressWebp) {
                const compressed = await this.convertImage(resultData.base64, "webp", options.webpQuality || 0.85);
                resultData = { ...resultData, ...compressed };
            }
            return resultData;
        } catch (e: any) { return { error: e.message }; }
    }

    public async convertImage(base64: string, format: string = "webp", quality: number = 0.85, crop?: { x: number, y: number, width: number, height: number }, targetSize?: { width: number, height: number }): Promise<{url: string, base64: string}> {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const outW = targetSize?.width || crop?.width || img.width;
                const outH = targetSize?.height || crop?.height || img.height;
                canvas.width = outW;
                canvas.height = outH;
                
                const ctx = canvas.getContext('2d')!;
                if (format === "jpg") {
                    ctx.fillStyle = "#FFFFFF";
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
                if (crop) {
                    ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, outW, outH);
                } else {
                    ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, outW, outH);
                }
                const mimeType = format === "png" ? "image/png" : (format === "jpg" ? "image/jpeg" : "image/webp");
                const url = canvas.toDataURL(mimeType, quality);
                resolve({ url, base64: url.split(',')[1] });
            };
            img.src = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
        });
    }

    public async composeAndExport(
        sourceImg: HTMLImageElement,
        format: string,
        quality: number,
        canvasSize: number,
        viewerState: { x: number, y: number, scale: number },
        freeBox: { top: number, left: number, width: number, height: number },
        targetRes: { w: number, h: number }
    ): Promise<{url: string, base64: string}> {
        // 1. Create a virtual canvas to represent the 1536x1536 stage
        const stageCanvas = document.createElement('canvas');
        stageCanvas.width = canvasSize;
        stageCanvas.height = canvasSize;
        const sCtx = stageCanvas.getContext('2d')!;

        // 2. Handle background
        if (format === 'jpg') {
            sCtx.fillStyle = "#FFFFFF";
            sCtx.fillRect(0, 0, canvasSize, canvasSize);
        }

        // 3. Draw image at current pan/zoom relative to stage
        sCtx.drawImage(
            sourceImg,
            viewerState.x,
            viewerState.y,
            sourceImg.naturalWidth * viewerState.scale,
            sourceImg.naturalHeight * viewerState.scale
        );

        // 4. Extract the cropped segment from the stage
        const cropX = (freeBox.left / 100) * canvasSize;
        const cropY = (freeBox.top / 100) * canvasSize;
        const cropW = (freeBox.width / 100) * canvasSize;
        const cropH = (freeBox.height / 100) * canvasSize;

        // 5. Scale to target output resolution
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = targetRes.w;
        finalCanvas.height = targetRes.h;
        const fCtx = finalCanvas.getContext('2d')!;
        
        // Use high-quality resampling if supported
        fCtx.imageSmoothingEnabled = true;
        fCtx.imageSmoothingQuality = 'high';

        fCtx.drawImage(
            stageCanvas,
            cropX, cropY, cropW, cropH,
            0, 0, targetRes.w, targetRes.h
        );

        const mimeType = format === "png" ? "image/png" : (format === "jpg" ? "image/jpeg" : "image/webp");
        const url = finalCanvas.toDataURL(mimeType, quality);
        return { url, base64: url.split(',')[1] };
    }

    public async chromaKey(base64: string, options: ChromaOptions = {}): Promise<{url: string, base64: string}> {
        const { tolerance = 1.15, contiguous = false, smoothing = 0.1, targetColor = { r: 0, g: 255, b: 0 }, erosion = 0, feathering = 2 } = options;
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width; canvas.height = img.height;
                const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                const width = canvas.width, height = canvas.height;
                
                // BACK TO BASICS: Normalized Distance Algorithm (Based on historical stable commits)
                const alphaBuffer = new Uint8ClampedArray(width * height);
                const tr = targetColor.r, tg = targetColor.g, tb = targetColor.b;
                
                // Fine-tune t1, t2 range to fit 0.0 - 2.0 slider
                const t1 = tolerance;
                const t2 = Math.max(0.01, tolerance - Math.max(0.01, smoothing));

                for (let i = 0; i < width * height; i++) {
                    const r = data[i*4], g = data[i*4+1], b = data[i*4+2], a = data[i*4+3];
                    if (a < 10) { alphaBuffer[i] = 0; continue; } // Treat pre-existing transparency as background

                    let score = 0;
                    // Primary color boost
                    if (tg > tr && tg > tb) score = g / Math.max(r, b, 1);
                    else if (tr > tg && tr > tb) score = r / Math.max(g, b, 1);
                    else if (tb > tr && tb > tg) score = b / Math.max(r, g, 1);
                    
                    // Cap the ratio score so it doesn't break the 0.0-2.0 slider scale
                    score = Math.min(2.0, score); 
                    
                    // Fallback to geometric distance for blended colors
                    const distScore = 2.0 - (Math.sqrt((r-tr)**2 + (g-tg)**2 + (b-tb)**2) / 128);
                    score = (score + distScore) / 2;

                    if (score > t1) alphaBuffer[i] = 0;
                    else if (score < t2) alphaBuffer[i] = 255;
                    else {
                        const factor = (score - t2) / (t1 - t2);
                        alphaBuffer[i] = Math.floor(255 * (1 - factor));
                    }
                }

                if (contiguous) {
                    const visited = new Uint8Array(width * height);
                    const queue = new Int32Array(width * height);
                    let head = 0, tail = 0;
                    
                    // Scan all 4 edges for seeds to avoid 'trapped' background behind frames
                    const addSeed = (x: number, y: number) => {
                        const idx = y * width + x;
                        if (alphaBuffer[idx] < 128 && !visited[idx]) { queue[tail++] = idx; visited[idx] = 1; }
                    };
                    for (let x = 0; x < width; x++) { addSeed(x, 0); addSeed(x, height - 1); }
                    for (let y = 0; y < height; y++) { addSeed(0, y); addSeed(width - 1, y); }

                    while(head < tail) {
                        const curr = queue[head++], x = curr % width, y = (curr / width) | 0;
                        if (x + 1 < width) { const n = curr + 1; if (!visited[n] && alphaBuffer[n] < 128) { visited[n] = 1; queue[tail++] = n; } }
                        if (x - 1 >= 0) { const n = curr - 1; if (!visited[n] && alphaBuffer[n] < 128) { visited[n] = 1; queue[tail++] = n; } }
                        if (y + 1 < height) { const n = curr + width; if (!visited[n] && alphaBuffer[n] < 128) { visited[n] = 1; queue[tail++] = n; } }
                        if (y - 1 >= 0) { const n = curr - width; if (!visited[n] && alphaBuffer[n] < 128) { visited[n] = 1; queue[tail++] = n; } }
                    }
                    for(let i=0; i<width*height; i++) if(!visited[i]) alphaBuffer[i] = 255;
                }

                // Apply Erosion
                if (erosion > 0) {
                    const temp = new Uint8ClampedArray(alphaBuffer);
                    for (let r = 0; r < erosion; r++) {
                        const prev = r === 0 ? temp : new Uint8ClampedArray(alphaBuffer);
                        for (let y = 1; y < height - 1; y++) {
                            for (let x = 1; x < width - 1; x++) {
                                const idx = y * width + x;
                                if (prev[idx] > 0 && (prev[idx-1] === 0 || prev[idx+1] === 0 || prev[idx-width] === 0 || prev[idx+width] === 0)) alphaBuffer[idx] = 0;
                            }
                        }
                    }
                }

                // Apply Feathering
                if (feathering > 0) {
                    const radius = Math.floor(feathering);
                    const div = radius * 2 + 1;
                    const hBlur = new Uint8ClampedArray(alphaBuffer.length);
                    for(let y=0; y<height; y++) {
                        let sum = 0;
                        for(let i=-radius; i<=radius; i++) sum += alphaBuffer[y*width + Math.min(width-1, Math.max(0, i))];
                        for(let x=0; x<width; x++) {
                            hBlur[y*width + x] = sum / div;
                            sum += alphaBuffer[y*width + Math.min(width-1, x + radius + 1)] - alphaBuffer[y*width + Math.max(0, x - radius)];
                        }
                    }
                    for(let x=0; x<width; x++) {
                        let sum = 0;
                        for(let i=-radius; i<=radius; i++) sum += hBlur[Math.min(height-1, Math.max(0, i))*width + x];
                        for(let y=0; y<height; y++) {
                            alphaBuffer[y*width + x] = sum / div;
                            sum += hBlur[Math.min(height-1, y + radius + 1)*width + x] - hBlur[Math.max(0, y - radius)*width + x];
                        }
                    }
                }

                // Final Pass: Apply Alpha and Spill Suppression
                for (let i = 0; i < width * height; i++) {
                    const alpha = alphaBuffer[i];
                    data[i * 4 + 3] = alpha;
                    if (alpha < 200) {
                        const r = data[i*4], g = data[i*4+1], b = data[i*4+2];
                        if (tg > tr && tg > tb) data[i*4+1] = Math.min(g, (r + b) / 2);
                        else if (tr > tg && tr > tb) data[i*4] = Math.min(r, (g + b) / 2);
                        else if (tb > tr && tb > tg) data[i*4+2] = Math.min(b, (r + g) / 2);
                    }
                }
                
                ctx.putImageData(imageData, 0, 0);
                const finalUrl = canvas.toDataURL('image/png');
                resolve({ url: finalUrl, base64: finalUrl.split(',')[1] });
            };
            img.onerror = () => resolve({ url: base64, base64: base64.split(',')[1] || "" });
            img.src = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
        });
    }
}

export const gemini = new GeminiService();
