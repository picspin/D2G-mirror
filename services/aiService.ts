// Fix: Implementing the full content of aiService.ts which was missing.
import { GoogleGenAI, Type } from '@google/genai';
import type { ProviderConfig, GraphSuggestion, ExtractedDataResponse, CustomModelConfig } from '../types';

// Helper function to robustly extract a JSON string from a model's text response
const extractJsonString = (text: string): string | null => {
    if (!text) return null;

    // Case 1: The text is wrapped in ```json ... ```
    const markdownMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (markdownMatch && markdownMatch[1]) {
        return markdownMatch[1];
    }

    // Case 2: The JSON is embedded in other text. Find the first '{' or '[' and last '}' or ']'.
    const firstBrace = text.indexOf('{');
    const firstBracket = text.indexOf('[');
    
    let start = -1;
    if (firstBrace === -1) start = firstBracket;
    else if (firstBracket === -1) start = firstBrace;
    else start = Math.min(firstBrace, firstBracket);

    const lastBrace = text.lastIndexOf('}');
    const lastBracket = text.lastIndexOf(']');

    let end = Math.max(lastBrace, lastBracket);

    if (start !== -1 && end > start) {
        return text.substring(start, end + 1);
    }
    
    // Case 3: The text might be the JSON itself.
    const trimmedText = text.trim();
    if (trimmedText.startsWith('{') || trimmedText.startsWith('[')) {
        return trimmedText;
    }

    return null; // No JSON found
};


export const analyzeDataForGraphSuggestions = async (
    data: string,
    providerConfig: ProviderConfig
): Promise<{ report: string; suggestions: GraphSuggestion[] }> => {
    if (providerConfig.provider === 'custom' && providerConfig.custom) {
        const { baseUrl, apiKey, model } = providerConfig.custom;
        if (!baseUrl || !apiKey || !model) {
            throw new Error('Custom model is not configured properly.');
        }
        const cleanedBaseUrl = baseUrl.replace(/\/$/, '');
        
        const prompt = `You are an expert data visualization assistant specializing in the G2 charting library. Your task is to analyze the provided dataset and suggest suitable graph visualizations.
The dataset is as follows:
---
${data}
---
Based on this data, please provide:
1. A brief analysis report of the data, highlighting key features, patterns, or potential insights.
2. An array of 3 diverse and insightful graph suggestions. Each suggestion must include a 'title' (a descriptive name for the chart) and a 'spec' (a valid JSON object for the G2 charting library).

The 'spec' must adhere to the following rules:
- It should NOT include the 'data' property. The data will be injected separately.
- The 'encode' properties (like x, y, color) must correctly map to the fields/columns present in the dataset.
- Choose appropriate and varied chart types (e.g., bar chart, line chart, scatter plot, pie chart) that best represent the data.

Your entire output must be a single, valid JSON object with two keys: "report" (a string) and "suggestions" (an array of objects, each with "title" and "spec"). Do not include any other text or markdown formatting outside of the JSON object.`;

        try {
            const response = await fetch(`${cleanedBaseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'api-key': apiKey,
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.7,
                    response_format: { type: 'json_object' },
                })
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`Custom model API error: ${response.status} ${response.statusText} - ${errorBody}`);
            }

            const result = await response.json();
            const responseText = result.choices[0].message.content;
            
            const jsonString = extractJsonString(responseText);

            if (!jsonString) {
                console.error("Could not extract JSON from custom model response:", responseText);
                throw new Error(`Custom model returned a non-JSON response. The response started with: "${responseText.substring(0, 50)}..."`);
            }
            
            return JSON.parse(jsonString);

        } catch (error) {
            console.error('Error analyzing data with custom model:', error);
             if (error instanceof Error && error.message.includes('non-JSON response')) {
                throw error; // Re-throw our more specific error
            }
            if (error instanceof SyntaxError) { // JSON.parse error
                console.error("Malformed JSON received from custom model:", (error as any).responseText);
                throw new Error('Custom model returned malformed JSON. Check console for details.');
            }
            throw new Error('Failed to get graph suggestions from the custom AI model. Check console for details.');
        }
    }

    // Fix: Using GoogleGenAI according to guidelines.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // Fix: Using a powerful model for complex reasoning and JSON generation.
    const model = 'gemini-2.5-pro';

    const prompt = `You are an expert data visualization assistant specializing in the G2 charting library. Your task is to analyze the provided dataset and suggest suitable graph visualizations.
The dataset is as follows:
---
${data}
---
Based on this data, please provide:
1. A brief analysis report of the data, highlighting key features, patterns, or potential insights.
2. An array of 3 diverse and insightful graph suggestions. Each suggestion must include a 'title' (a descriptive name for the chart) and a 'spec' (a valid JSON object for the G2 charting library).

The 'spec' must adhere to the following rules:
- It should NOT include the 'data' property. The data will be injected separately.
- The 'encode' properties (like x, y, color) must correctly map to the fields/columns present in the dataset.
- Choose appropriate and varied chart types (e.g., bar chart, line chart, scatter plot, pie chart) that best represent the data.

Your entire output must be a single, valid JSON object that conforms to the specified schema.`;

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            report: { 
                type: Type.STRING,
                description: "A brief analysis of the provided data."
            },
            suggestions: {
                type: Type.ARRAY,
                description: "An array of 3 diverse G2 chart suggestions.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        title: { 
                            type: Type.STRING,
                            description: "A descriptive title for the chart."
                        },
                        spec: {
                            type: Type.OBJECT,
                            description: "A valid G2 chart specification object, without the data property. It should at least contain a 'type' property.",
                             // We define a minimal set of properties to ensure a valid schema,
                             // allowing the model flexibility for the complex parts like 'encode'.
                            properties: {
                                type: { type: Type.STRING, description: "The main type of the mark, e.g., 'interval', 'line'." }
                            },
                            required: ['type']
                        },
                    },
                    required: ['title', 'spec'],
                },
            },
        },
        required: ['report', 'suggestions'],
    };

    try {
        const result = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: responseSchema,
                // Using a higher temperature for more diverse suggestions
                temperature: 0.7,
            },
        });

        const jsonString = result.text;
        const parsedResponse = JSON.parse(jsonString);
        return parsedResponse;

    } catch (error) {
        console.error('Error analyzing data for graph suggestions:', error);
        throw new Error('Failed to get graph suggestions from the AI model. Please check the console for details.');
    }
};

export const analyzeGraphImage = async (
    base64Image: string,
    mimeType: string,
    providerConfig: ProviderConfig
): Promise<ExtractedDataResponse> => {
    if (providerConfig.provider === 'custom' && providerConfig.custom) {
        const { baseUrl, apiKey, model } = providerConfig.custom;
        if (!baseUrl || !apiKey || !model) {
            throw new Error('Custom model is not configured properly.');
        }
        const cleanedBaseUrl = baseUrl.replace(/\/$/, '');

        const prompt = `Analyze the provided image.
1. First, determine if the image is a data visualization, such as a chart or a graph.
2. If it is NOT a chart or graph, your JSON response should have 'isChart' as false and a 'reason' key explaining why.
3. If it IS a chart or graph, your JSON response should have 'isChart' as true and a 'report' key containing a detailed analysis. The analysis should:
    a. Identify the chart type (e.g., bar chart, line graph, pie chart, scatter plot).
    b. Extract the underlying data as accurately as possible. Present it in a clear, structured format like a Markdown table.
    c. Summarize the key insights, trends, or the main point conveyed by the chart.
    d. Combine all findings from steps a, b, and c into a comprehensive analysis report formatted in Markdown.

Your entire response must be a single, valid JSON object. Do not include any other text or markdown formatting outside of the JSON object.`;

        try {
            const response = await fetch(`${cleanedBaseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'api-key': apiKey,
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: prompt },
                                {
                                    type: 'image_url',
                                    image_url: {
                                        url: `data:${mimeType};base64,${base64Image}`
                                    }
                                }
                            ]
                        }
                    ],
                    response_format: { type: 'json_object' },
                })
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`Custom model API error: ${response.status} ${response.statusText} - ${errorBody}`);
            }

            const result = await response.json();
            const responseText = result.choices[0].message.content;
            
            const jsonString = extractJsonString(responseText);

            if (!jsonString) {
                console.error("Could not extract JSON from custom model response:", responseText);
                throw new Error(`Custom model returned a non-JSON response. The response started with: "${responseText.substring(0, 50)}..."`);
            }

            return JSON.parse(jsonString);

        } catch (error) {
            console.error('Error analyzing image with custom model:', error);
            if (error instanceof Error && error.message.includes('non-JSON response')) {
                throw error; // Re-throw our more specific error
            }
            if (error instanceof SyntaxError) { // JSON.parse error
                console.error("Malformed JSON received from custom model:", (error as any).responseText);
                throw new Error('Custom model returned malformed JSON. Check console for details.');
            }
            throw new Error('Failed to analyze the graph image with the custom AI model. Check console for details.');
        }
    }

    // Fix: Using GoogleGenAI according to guidelines.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // Fix: Using a powerful model capable of multimodal input.
    const model = 'gemini-2.5-pro';

    const prompt = `Analyze the provided image.
1. First, determine if the image is a data visualization, such as a chart or a graph.
2. If it is NOT a chart or graph, provide a brief reason why.
3. If it IS a chart or graph, perform a detailed analysis:
    a. Identify the chart type (e.g., bar chart, line graph, pie chart, scatter plot).
    b. Extract the underlying data as accurately as possible. Present it in a clear, structured format like a Markdown table.
    c. Summarize the key insights, trends, or the main point conveyed by the chart.
    d. Combine all findings from steps a, b, and c into a comprehensive analysis report formatted in Markdown.

Your entire response must be a single, valid JSON object conforming to the specified schema.`;

    const imagePart = {
        inlineData: {
            data: base64Image,
            mimeType: mimeType,
        },
    };

    const textPart = {
        text: prompt
    };

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            isChart: {
                type: Type.BOOLEAN,
                description: 'True if the image is a chart or graph, false otherwise.'
            },
            report: {
                type: Type.STRING,
                description: 'The full analysis report in Markdown format if the image is a chart. This field should be omitted if it is not a chart.'
            },
            reason: {
                type: Type.STRING,
                description: 'A brief explanation for why the image is not considered a chart. This field should be omitted if it is a chart.'
            },
        },
        required: ['isChart'],
    };

    try {
        const result = await ai.models.generateContent({
            model: model,
            contents: { parts: [imagePart, textPart] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: responseSchema,
            },
        });

        const jsonString = result.text;
        return JSON.parse(jsonString);

    } catch (error) {
        console.error('Error analyzing graph image:', error);
        throw new Error('Failed to analyze the graph image with the AI model. Please check the console for details.');
    }
};


export const fetchCustomModels = async (config: CustomModelConfig): Promise<string[]> => {
    if (!config.baseUrl || !config.apiKey) {
        throw new Error("API Base URL and API Key are required.");
    }
    const cleanedBaseUrl = config.baseUrl.replace(/\/$/, '');
    try {
        const response = await fetch(`${cleanedBaseUrl}/models`, {
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'api-key': config.apiKey,
            }
        });
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new Error(`Authentication failed (${response.status}). Please check your API Key.`);
            }
            throw new Error(`Failed to fetch models: Server responded with ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        if (Array.isArray(data.data)) {
            return data.data.map((model: any) => model.id).sort();
        }
        if(Array.isArray(data)) { // Some providers return the array directly
            return data.map((model: any) => model.id).sort();
        }
        return [];
    } catch (error) {
        console.error("Failed to fetch custom models:", error);
        if (error instanceof Error) {
            throw error;
        }
        throw new Error("An unknown error occurred while fetching models.");
    }
};

export const testCustomModelConnection = async (config: CustomModelConfig): Promise<void> => {
     if (!config.baseUrl || !config.apiKey || !config.model) {
        throw new Error("URL, API Key, and Model Name are required.");
    }
    const cleanedBaseUrl = config.baseUrl.replace(/\/$/, '');
    try {
        const response = await fetch(`${cleanedBaseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`,
                'api-key': config.apiKey,
            },
            body: JSON.stringify({
                model: config.model,
                messages: [{ role: 'user', content: 'Say "hello"' }],
                max_tokens: 5,
                stream: false
            })
        });
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                 throw new Error(`Authentication failed (${response.status}). Check API Key.`);
            } else if (response.status === 404) {
                 throw new Error(`Endpoint/Model not found (${response.status}). Check URL and Model Name.`);
            }
            throw new Error(`Connection failed: Server responded with ${response.status}`);
        }
    } catch (error) {
        console.error("Custom model connection test failed:", error);
        if (error instanceof Error) {
            throw error;
        }
        throw new Error("Connection test failed. Check console for details.");
    }
};