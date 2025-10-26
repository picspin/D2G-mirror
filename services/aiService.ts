
import { GoogleGenAI, Type } from '@google/genai';
import type { ChartRecommendation, ExtractedDataResponse, ProviderConfig, CustomModelConfig } from '../types';

const getGeminiClient = () => {
    // Per coding guidelines, API key must be from process.env.API_KEY and initialized with a named parameter.
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// --- Data to Graph ---

const dataToGraphPrompt = (dataSample: string, fileName: string) => `
Analyze the following data sample from the file "${fileName}" and provide recommendations for the best chart types to visualize it. The data is in JSON format.
Data sample:
${dataSample}

Your task is to:
1.  Provide a brief, insightful analysis of the data's structure, key fields, and potential relationships. This should be a single paragraph.
2.  Suggest exactly 3 different chart types that would be effective for this data.
3.  For each recommendation, provide:
    a. A descriptive title for the chart (e.g., "Monthly Sales Trend").
    b. The chart type (must be one of: 'line', 'column', 'bar', 'pie', 'area', 'scatter', 'rose').
    c. A concise reason (max 20 words) explaining why this chart is a good fit.
    d. A valid JSON configuration object for Ant Design Charts (G2Plot). The config must only include fields present in the data sample. For example: { "xField": "date", "yField": "sales" }. Do not invent fields. Use the exact field names from the data.

Your response must be a single, valid JSON object, without any surrounding text or markdown.
`;

const dataToGraphSchema = {
    type: Type.OBJECT,
    properties: {
        dataAnalysis: {
            type: Type.STRING,
            description: "A brief analysis of the data's structure and key fields."
        },
        chartRecommendations: {
            type: Type.ARRAY,
            description: "An array of 3 recommended chart visualizations.",
            items: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING, description: "A descriptive title for the chart." },
                    chartType: { type: Type.STRING, description: "The type of chart (e.g., 'line', 'column')." },
                    reason: { type: Type.STRING, description: "A concise reason for choosing this chart type." },
                    config: {
                        type: Type.OBJECT,
                        description: "A valid JSON configuration object for Ant Design Charts, mapping data fields.",
                        // Define common properties to guide the model, but they are not required.
                        properties: {
                            xField: { type: Type.STRING },
                            yField: { type: Type.STRING },
                            seriesField: { type: Type.STRING },
                            colorField: { type: Type.STRING },
                            angleField: { type: Type.STRING },
                            sizeField: { type: Type.STRING },
                            percent: { type: Type.STRING },
                            taskField: { type: Type.STRING },
                            sourceField: { type: Type.STRING },
                            targetField: { type: Type.STRING },
                            valueField: { type: Type.STRING },
                        }
                    },
                },
                required: ['title', 'chartType', 'reason', 'config'],
            },
        },
    },
    required: ['dataAnalysis', 'chartRecommendations'],
};


export async function analyzeDataForGraphSuggestions(dataSample: string, fileName: string, providerConfig: ProviderConfig): Promise<{ dataAnalysis: string; chartRecommendations: ChartRecommendation[] }> {
    if (providerConfig.provider === 'google') {
        const ai = getGeminiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: dataToGraphPrompt(dataSample, fileName),
            config: {
                responseMimeType: 'application/json',
                responseSchema: dataToGraphSchema as any, // Cast to any to handle schema structure
            },
        });

        const jsonText = response.text.trim();
        try {
            return JSON.parse(jsonText);
        } catch (e) {
            console.error("Failed to parse JSON response from Gemini:", jsonText, e);
            throw new Error("The AI returned an invalid response. Please try again.");
        }
    } else { // 'custom'
        const customConfig = providerConfig.custom;
        if (!customConfig || !customConfig.baseUrl || !customConfig.apiKey || !customConfig.model) {
            throw new Error("Custom model provider is not configured correctly.");
        }
        const response = await fetch(`${customConfig.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${customConfig.apiKey}`
            },
            body: JSON.stringify({
                model: customConfig.model,
                messages: [{ role: 'user', content: dataToGraphPrompt(dataSample, fileName) }],
                response_format: { type: "json_object" }
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Custom API request failed: ${response.status} ${response.statusText} - ${errorBody}`);
        }

        const result = await response.json();
        const jsonText = result.choices[0].message.content;
        try {
            // Models sometimes wrap JSON in markdown code blocks. This extracts the JSON.
            const match = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            const parsableText = match ? match[1] : jsonText;
            return JSON.parse(parsableText);
        } catch (e) {
            console.error("Failed to parse JSON response from custom API:", jsonText, e);
            throw new Error("The custom AI returned an invalid response. Please try again.");
        }
    }
}

// --- Graph to Data ---

const graphToDataPrompt = `
You are an expert data analyst. Your task is to analyze the provided image.

1.  First, determine if the image is a data visualization chart or graph (e.g., bar chart, line graph, pie chart, etc.).
2.  If it is NOT a chart/graph, respond with a JSON object: { "isChart": false, "reason": "The image does not appear to be a data visualization." }.
3.  If it IS a chart/graph, respond with a JSON object: { "isChart": true, "report": "..." }.
4.  The "report" field should be a detailed analysis of the chart, formatted as Markdown. The report must include:
    *   **Chart Type:** Identify the type of chart (e.g., "Vertical Bar Chart", "Multi-series Line Graph").
    *   **Data Summary:** Extract and present the key data points in a Markdown table.
    *   **Insights:** Provide 2-3 bulleted key insights or trends observed from the data.
    *   **Conclusion:** A brief concluding sentence summarizing the chart's main takeaway.

Do not include any text or markdown formatting outside of the JSON object. Your entire response must be a single, valid JSON object.
`;

const graphToDataSchema = {
    type: Type.OBJECT,
    properties: {
        isChart: { type: Type.BOOLEAN },
        report: { type: Type.STRING, description: "A markdown report if it is a chart." },
        reason: { type: Type.STRING, description: "Reason if it's not a chart." },
    },
    required: ['isChart'],
};

export async function analyzeGraphImage(base64Image: string, mimeType: string, providerConfig: ProviderConfig): Promise<ExtractedDataResponse> {
    const imagePart = {
        inlineData: {
            data: base64Image,
            mimeType: mimeType,
        },
    };
    const textPart = { text: graphToDataPrompt };

    if (providerConfig.provider === 'google') {
        const ai = getGeminiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [textPart, imagePart] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: graphToDataSchema as any, // Cast to any to handle schema structure
            }
        });

        const jsonText = response.text.trim();
        try {
            return JSON.parse(jsonText);
        } catch (e) {
            console.error("Failed to parse JSON response from Gemini:", jsonText, e);
            throw new Error("The AI returned an invalid response. Please try again.");
        }
    } else { // 'custom'
        const customConfig = providerConfig.custom;
        if (!customConfig || !customConfig.baseUrl || !customConfig.apiKey || !customConfig.model) {
            throw new Error("Custom model provider is not configured correctly.");
        }

        const response = await fetch(`${customConfig.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${customConfig.apiKey}`
            },
            body: JSON.stringify({
                model: customConfig.model,
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'text', text: graphToDataPrompt },
                        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } }
                    ]
                }],
                response_format: { type: "json_object" }
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Custom API request failed: ${response.status} ${response.statusText} - ${errorBody}`);
        }

        const result = await response.json();
        const jsonText = result.choices[0].message.content;
        try {
            // Models sometimes wrap JSON in markdown code blocks. This extracts the JSON.
            const match = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            const parsableText = match ? match[1] : jsonText;
            return JSON.parse(parsableText);
        } catch (e) {
            console.error("Failed to parse JSON response from custom API:", jsonText, e);
            throw new Error("The custom AI returned an invalid response. Please try again.");
        }
    }
}

// --- Custom Model Management ---

export async function fetchCustomModels(config: CustomModelConfig): Promise<string[]> {
    if (!config.baseUrl || !config.apiKey) {
        throw new Error("API URL and API Key are required to fetch models.");
    }
    const response = await fetch(`${config.baseUrl}/models`, {
        headers: {
            'Authorization': `Bearer ${config.apiKey}`
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}. ${errorText}`);
    }

    const result = await response.json();
    if (!result.data || !Array.isArray(result.data)) {
        throw new Error("Invalid response format from /models endpoint. Expected a 'data' array.");
    }

    return result.data.map((model: any) => model.id).sort();
}

export async function testCustomModelConnection(config: CustomModelConfig): Promise<void> {
    if (!config.baseUrl || !config.apiKey || !config.model) {
        throw new Error("API URL, API Key, and Model Name are required for testing.");
    }
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
            model: config.model,
            messages: [{ role: 'user', content: "Say 'hello'" }],
            max_tokens: 5
        })
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Connection test failed: ${response.status} ${response.statusText} - ${errorBody}`);
    }
    // If it doesn't throw, it's a success
}
