
import { GoogleGenAI, Type } from "@google/genai";
import type { GraphSuggestion, ExtractedDataResponse } from '../types';

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const dataToGraphPrompt = (data: string) => `
You are a data visualization expert. Analyze the following data and suggest up to 3 suitable chart types from this list: ["Bar", "Line", "Pie", "Scatter", "Radar"]. 
For each suggestion, provide a 'chartType', a 'title', a brief 'reason', and map the data into a JSON array of objects suitable for the 'recharts' library.
For Bar, Line, and Radar charts, the data format is typically [{ "name": "category", "value": 123 }].
For Pie charts, the data format must be [{ "name": "category", "value": 123 }].
For Scatter charts, the data format must be [{ "x": 10, "y": 20 }].
Ensure the keys in the data objects are simple strings like "name", "value", "x", "y". The 'data' field cannot be empty.
Respond ONLY with a valid JSON array that strictly follows the provided schema.

Data:
\`\`\`
${data}
\`\`\`
`;

const graphToDataPrompt = `
You are an expert in optical character recognition and data extraction from charts. 
Analyze the following image of a data visualization.
If it is a standard data chart (like a bar, line, pie, or scatter plot), extract the underlying data.
Respond with a JSON object with two keys: "isChart: true" and "data", where "data" is an array of objects representing the data points.
If the image is NOT a data chart, respond with the JSON object: {"isChart": false, "reason": "Sorry, this is not a data graph I can translate into a table."}.
Respond ONLY with the JSON object that conforms to the schema.
`;

export const analyzeDataForGraphSuggestions = async (fileContent: string): Promise<GraphSuggestion[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: dataToGraphPrompt(fileContent),
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              chartType: { type: Type.STRING, enum: ["Bar", "Line", "Pie", "Scatter", "Radar"]},
              title: { type: Type.STRING },
              reason: { type: Type.STRING },
              data: { 
                type: Type.ARRAY, 
                items: { 
                    type: Type.OBJECT,
                    // Allow any properties for the data objects
                    properties: {},
                    additionalProperties: true
                } 
              }
            },
            required: ["chartType", "title", "reason", "data"]
          }
        },
      },
    });

    const jsonString = response.text.trim();
    return JSON.parse(jsonString) as GraphSuggestion[];
  } catch (error)
 {
    console.error("Error analyzing data for graph suggestions:", error);
    if (error instanceof Error && error.message.includes('JSON')) {
        throw new Error("AI returned an invalid format. Please try a different file or check the data format.");
    }
    throw new Error("Failed to get graph suggestions from AI.");
  }
};

export const analyzeGraphImage = async (base64Image: string, mimeType: string): Promise<ExtractedDataResponse> => {
    try {
        const imagePart = {
            inlineData: {
                data: base64Image,
                mimeType,
            },
        };
        const textPart = { text: graphToDataPrompt };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] },
             config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        isChart: { type: Type.BOOLEAN },
                        data: { 
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {},
                                additionalProperties: true
                            }
                        },
                        reason: { type: Type.STRING }
                    },
                    required: ["isChart"]
                }
             }
        });

        const jsonString = response.text.trim();
        const result = JSON.parse(jsonString);

        if (typeof result.isChart === 'boolean') {
             return result as ExtractedDataResponse;
        }

        throw new Error("Invalid response format from AI.");
    } catch (error) {
        console.error("Error analyzing graph image:", error);
        if (error instanceof Error && error.message.includes('JSON')) {
            throw new Error("AI returned an invalid format. Please try a different image.");
        }
        throw new Error("Failed to analyze the graph image with AI.");
    }
};
