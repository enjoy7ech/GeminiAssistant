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
            throw new Error(`无法获取模型列表: ${e.message || '未知错误'} \n\n请检查 API Key 或代理地址是否正确。`);
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
            // 过滤掉错误消息和空消息，避免破坏上下文
            const validHistory = history.filter(item => 
                item.content && 
                item.content.trim() && 
                !item.content.startsWith("消息发送失败:")
            );

            // 转换历史记录格式为 SDK 要求的格式
            const formattedHistory = validHistory.map(item => ({
                role: item.role,
                parts: [{ text: item.content }]
            }));

            // 将当前 prompt 加入到内容列表
            const contents = [
                ...formattedHistory,
                { role: 'user', parts: [{ text: prompt }] }
            ];

            const result = await this.client.models.generateContent({
                model: this.currentModel,
                contents,
                config: cacheName ? { cachedContent: cacheName } : undefined
            });

            // 获取生成的文本结果 (新版 SDK 路径可能有所不同)
            const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) {
                // 尝试通用获取方法
                const altText = result.text;
                if (!altText) throw new Error("未返回文本内容");
                return altText;
            }
            return text;
        } catch (e: any) { 
            console.error("SendMessage Error:", e);
            return `消息发送失败: ${e.message}`; 
        }
    }

    // --- Context Caching Methods ---
    public async createCache(displayName: string, contents: any[], systemInstruction?: string, ttlSeconds: number = 3600) {
        if (!this.client) return null;
        try {
            // 转换格式
            const formattedContents = contents.map(item => ({
                role: item.role,
                parts: [{ text: item.content }]
            }));

            const result = await this.client.caches.create({
                model: this.currentModel,
                config: {
                    contents: formattedContents,
                    displayName,
                    systemInstruction,
                    ttl: `${ttlSeconds}s`
                }
            });
            return result;
        } catch (e: any) {
            console.error("Failed to create cache:", e);
            throw e;
        }
    }

    public async listCaches() {
        if (!this.client) return [];
        try {
            const caches = [];
            const result = await this.client.caches.list();
            for await (const c of result) caches.push(c);
            return caches;
        } catch (e) { return []; }
    }

    public async deleteCache(name: string) {
        if (!this.client) return;
        try {
            await this.client.caches.delete({ name });
        } catch (e) { console.error("Failed to delete cache:", e); }
    }

    public async generateImage(userPrompt: string, options: ImageGenerateOptions = {}) {
        if (!this.client) return { error: "请配置 API Key" };
        let finalPrompt = userPrompt;
        
        // 绿幕逻辑增强
        if (options.useGreenScreen) {
            finalPrompt += "。关键技术限制：背景必须是平滑无纹理的纯度 100% 绿色 (#00FF00)。主体（Object）与背景必须有极其锐利的切分。除了背景外，画面中的主体及其任何微小部分严禁出现哪怕一点绿色，请将所有绿色元素替换为鲜明的对比色，确保主体颜色纯净无溢色。";
        }

        try {
            const isImagen = this.imageModel.toLowerCase().includes('imagen') || 
                             this.imageModel.toLowerCase().includes('nanobanana');
            let resultData: { base64: string, url: string, originalUrl?: string };

            if (isImagen) {
                const response = await this.client.models.generateImages({
                    model: this.imageModel,
                    prompt: finalPrompt,
                    parameters: { number_of_images: 1 }
                });
                const img = response.images?.[0];
                if (!img) throw new Error("未生成图片数据");
                resultData = { base64: img.base64, url: img.url || `data:image/png;base64,${img.base64}` };
            } else {
                const result = await this.client.models.generateContent({
                    model: this.imageModel,
                    contents: [{ role: 'user', parts: [{ text: finalPrompt }] }]
                });
                const candidate = result.candidates?.[0];
                const imagePart = candidate?.content?.parts?.find((p: any) => p.inlineData);
                if (!imagePart) throw new Error("模型未返回图片数据");
                const b64 = imagePart.inlineData.data;
                const url = `data:${imagePart.inlineData.mimeType || 'image/png'};base64,${b64}`;
                resultData = { base64: b64, url: url, originalUrl: url };
            }

            let finalResult: any = { ...resultData };
            if (options.compressWebp) {
                const compressed = await this.convertImage(finalResult.base64, "webp", options.webpQuality || 0.85);
                finalResult = { ...finalResult, ...compressed };
            }
            return finalResult;
        } catch (e: any) { return { error: `生成异常: ${e.message}` }; }
    }

    public async convertImage(base64: string, format: string = "webp", quality: number = 0.85, crop?: { x: number, y: number, width: number, height: number }): Promise<{url: string, base64: string}> {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // Use crop dimensions or original dimensions
                canvas.width = crop ? crop.width : img.width;
                canvas.height = crop ? crop.height : img.height;
                
                const ctx = canvas.getContext('2d')!;
                if (format === "jpg") { ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
                else ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = "high";

                if (crop) {
                    ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
                } else {
                    ctx.drawImage(img, 0, 0);
                }

                const mimeType = format === "png" ? "image/png" : (format === "jpg" ? "image/jpeg" : "image/webp");
                const newBaseUrl = canvas.toDataURL(mimeType, quality);
                resolve({ url: newBaseUrl, base64: newBaseUrl.split(',')[1] });
            };
            img.src = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
        });
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
                const tr = targetColor.r, tg = targetColor.g, tb = targetColor.b;
                const alphaBuffer = new Uint8ClampedArray(width * height);
                const t1 = tolerance, t2 = Math.max(1.0, tolerance - smoothing * 2);

                for (let i = 0; i < width * height; i++) {
                    const r = data[i*4], g = data[i*4+1], b = data[i*4+2];
                    let score = 0;
                    if (tg > tr && tg > tb) score = g / Math.max(r, b, 1);
                    else if (tr > tg && tr > tb) score = r / Math.max(g, b, 1);
                    else if (tb > tr && tb > tg) score = b / Math.max(r, g, 1);
                    else score = 2.0 - (Math.sqrt((r-tr)**2 + (g-tg)**2 + (b-tb)**2) / 150);
                    if (score > t1) alphaBuffer[i] = 0;
                    else if (score < t2) alphaBuffer[i] = 255;
                    else alphaBuffer[i] = Math.floor(255 * (1 - (score - t2) / (t1 - t2)));
                }

                if (contiguous) {
                    const visited = new Uint8Array(width * height), queue = new Int32Array(width * height);
                    let head = 0, tail = 0;
                    [[0,0], [width-1, 0], [0, height-1], [width-1, height-1]].forEach(([sx, sy]) => {
                        const idx = sy * width + sx; if (alphaBuffer[idx] < 128) { queue[tail++] = idx; visited[idx] = 1; }
                    });
                    while(head < tail) {
                        const curr = queue[head++], x = curr % width, y = (curr / width) | 0;
                        [[x+1, y], [x-1, y], [x, y+1], [x, y-1]].forEach(([nx, ny]) => {
                            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                                const nIdx = ny * width + nx; if (!visited[nIdx] && alphaBuffer[nIdx] < 128) { visited[nIdx] = 1; queue[tail++] = nIdx; }
                            }
                        });
                    }
                    for(let i=0; i<width*height; i++) if(!visited[i]) alphaBuffer[i] = 255;
                }

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

                // --- Feathering (Fast Box Blur for Alpha) ---
                if (feathering > 0) {
                    const blur = (src: Uint8ClampedArray, w: number, h: number, radius: number) => {
                        const out = new Uint8ClampedArray(src.length);
                        const wm = w - 1, hm = h - 1;
                        const div = radius * 2 + 1;
                        // const vsum = new Uint32Array(w);
                        
                        // Horizontal pass
                        for(let y=0; y<h; y++) {
                            let sum = 0;
                            for(let i=-radius; i<=radius; i++) sum += src[y*w + Math.min(wm, Math.max(0, i))];
                            for(let x=0; x<w; x++) {
                                out[y*w + x] = sum / div;
                                sum += src[y*w + Math.min(wm, x + radius + 1)] - src[y*w + Math.max(0, x - radius)];
                            }
                        }
                        
                        const out2 = new Uint8ClampedArray(src.length);
                        // Vertical pass
                        for(let x=0; x<w; x++) {
                            let sum = 0;
                            for(let i=-radius; i<=radius; i++) sum += out[Math.min(hm, Math.max(0, i))*w + x];
                            for(let y=0; y<h; y++) {
                                out2[y*w + x] = sum / div;
                                sum += out[Math.min(hm, y + radius + 1)*w + x] - out[Math.max(0, y - radius)*w + x];
                            }
                        }
                        return out2;
                    };
                    const radius = Math.floor(feathering);
                    const smoothed = blur(alphaBuffer, width, height, radius);
                    for(let i=0; i<alphaBuffer.length; i++) alphaBuffer[i] = smoothed[i];
                }

                for (let i = 0; i < width * height; i++) {
                    const alpha = alphaBuffer[i];
                    data[i * 4 + 3] = alpha;
                    // Spill Suppression (Optional: reduce target color influence in edge pixels)
                    if (alpha < 255) {
                        const r = data[i*4], g = data[i*4+1], b = data[i*4+2];
                        if (tg > tr && tg > tb) data[i*4+1] = Math.min(g, (r + b) / 2);
                        else if (tr > tg && tr > tb) data[i*4] = Math.min(r, (g + b) / 2);
                        else if (tb > tr && tb > tg) data[i*4+2] = Math.min(b, (r + g) / 2);
                    }
                }
                ctx.putImageData(imageData, 0, 0);
                const url = canvas.toDataURL('image/png');
                resolve({ url, base64: url.split(',')[1] });
            };
            img.src = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
        });
    }
}

export const gemini = new GeminiService();
