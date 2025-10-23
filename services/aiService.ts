
import { GoogleGenAI, Type } from "@google/genai";
import type { GraphSuggestion, ExtractedDataResponse, ModelConfig, CustomModelConfig } from '../types';

const dataToGraphSystemPrompt = `
You are a data visualization expert. Analyze the following data and suggest up to 3 suitable chart types from this list: ["Bar", "Line", "Pie", "Scatter", "Radar"]. 
For each suggestion, provide a 'chartType', a 'title', a brief 'reason', and map the data into a JSON array of objects suitable for the 'recharts' library.
For Bar, Line, and Radar charts, the data format is typically [{ "name": "category", "value": 123 }].
For Pie charts, the data format must be [{ "name": "category", "value": 123 }].
For Scatter charts, the data format must be [{ "x": 10, "y": 20 }].
Ensure the keys in the data objects are simple strings like "name", "value", "x", "y". The 'data' field cannot be empty.
Respond ONLY with a valid JSON array of objects. Do not include any markdown formatting or explanatory text outside of the JSON.
`;

const graphToDataSystemPrompt = `
You are an expert in optical character recognition and data extraction from charts. 
Analyze the following image of a data visualization.
If it is a standard data chart (like a bar, line, pie, or scatter plot), extract the underlying data.
Respond with a JSON object with two keys: "isChart: true" and "data", where "data" is an array of objects representing the data points.
If the image is NOT a data chart, respond with the JSON object: {"isChart": false, "reason": "Sorry, this is not a data graph I can translate into a table."}.
Respond ONLY with the JSON object. Do not include any markdown formatting or explanatory text outside of the JSON.
`;

const getGoogleAI = () => {
    const API_KEY = process.env.API_KEY;
    if (!API_KEY) {
        throw new Error("API_KEY environment variable not set for Google Gemini.");
    }
    return new GoogleGenAI({ apiKey: API_KEY });
};

export const analyzeDataForGraphSuggestions = async (fileContent: string, modelConfig: ModelConfig): Promise<GraphSuggestion[]> => {
  try {
    let jsonString: string;

    if (modelConfig.provider === 'google') {
        const ai = getGoogleAI();
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Data:\n\`\`\`\n${fileContent}\n\`\`\``,
            config: {
                systemInstruction: dataToGraphSystemPrompt,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            chartType: { type: Type.STRING, enum: ["Bar", "Line", "Pie", "Scatter", "Radar"] },
                            title: { type: Type.STRING },
                            reason: { type: Type.STRING },
                            data: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        name: { type: Type.STRING },
                                        value: { type: Type.NUMBER },
                                        x: { type: Type.NUMBER },
                                        y: { type: Type.NUMBER },
                                    },
                                    additionalProperties: true,
                                }
                            }
                        },
                        required: ["chartType", "title", "reason", "data"]
                    }
                },
            },
        });
        jsonString = response.text.trim();
    } else { // Custom OpenAI-like provider
        if (!modelConfig.custom) throw new Error("Custom model configuration is missing.");
        const { baseUrl, apiKey, model } = modelConfig.custom;
        const res = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: dataToGraphSystemPrompt },
                    { role: 'user', content: `Data:\n\`\`\`\n${fileContent}\n\`\`\`` }
                ],
                response_format: { type: "json_object" }
            })
        });
        if (!res.ok) throw new Error(`Custom API request failed: ${res.statusText}`);
        const data = await res.json();
        jsonString = data.choices[0].message.content;
    }

    return JSON.parse(jsonString) as GraphSuggestion[];
  } catch (error) {
    console.error("Error analyzing data for graph suggestions:", error);
    if (error instanceof Error && (error.message.includes('JSON') || error instanceof SyntaxError)) {
        throw new Error("AI returned an invalid format. Please try a different file or check the data format.");
    }
    throw new Error("Failed to get graph suggestions from AI.");
  }
};

export const analyzeGraphImage = async (base64Image: string, mimeType: string, modelConfig: ModelConfig): Promise<ExtractedDataResponse> => {
    try {
        let jsonString: string;

        if (modelConfig.provider === 'google') {
            const ai = getGoogleAI();
            const imagePart = { inlineData: { data: base64Image, mimeType } };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [imagePart] },
                config: {
                    systemInstruction: graphToDataSystemPrompt,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            isChart: { type: Type.BOOLEAN },
                            data: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        category: { type: Type.STRING },
                                        value: { type: Type.NUMBER },
                                        label: { type: Type.STRING },
                                    },
                                    additionalProperties: true
                                }
                            },
                            reason: { type: Type.STRING }
                        },
                        required: ["isChart"]
                    }
                }
            });
            jsonString = response.text.trim();
        } else { // Custom OpenAI-like provider
             if (!modelConfig.custom) throw new Error("Custom model configuration is missing.");
             const { baseUrl, apiKey, model } = modelConfig.custom;
             const res = await fetch(`${baseUrl}/chat/completions`, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                 body: JSON.stringify({
                     model,
                     messages: [
                         {
                            role: 'user',
                            content: [
                                { type: 'text', text: graphToDataSystemPrompt },
                                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } }
                            ]
                         }
                     ],
                     response_format: { type: "json_object" }
                 })
             });
             if (!res.ok) throw new Error(`Custom API request failed: ${res.statusText}`);
             const data = await res.json();
             jsonString = data.choices[0].message.content;
        }

        const result = JSON.parse(jsonString);
        if (typeof result.isChart === 'boolean') {
             return result as ExtractedDataResponse;
        }
        throw new Error("Invalid response format from AI.");
    } catch (error) {
        console.error("Error analyzing graph image:", error);
        if (error instanceof Error && (error.message.includes('JSON') || error instanceof SyntaxError)) {
            throw new Error("AI returned an invalid format. Please try a different image.");
        }
        throw new Error("Failed to analyze the graph image with AI.");
    }
};

export const testCustomModelConnection = async (config: CustomModelConfig): Promise<boolean> => {
    try {
        const { baseUrl, apiKey, model } = config;
        const res = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: 'Say "hello"' }],
                max_tokens: 5
            })
        });
        return res.ok;
    } catch (error) {
        console.error("Custom model connection test failed:", error);
        return false;
    }
};
