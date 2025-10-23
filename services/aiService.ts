
import { GoogleGenAI } from "@google/genai";
import type { GraphSuggestion, ExtractedDataResponse, ModelConfig, CustomModelConfig } from '../types';

const dataToGraphSystemPrompt = `
# Role: Principal Data Visualization Scientist

## Background:
You want publication-grade figures fast, across diverse datasets. We translate tables into clear, rigorous visuals by decoding structure, aligning goals, and layering task-driven interactivity. You need a system, not a gamble.

## Attention:
We turn ambiguity into structure, and structure into beauty. Precision first, then flair, always reproducible. Expect three defensible options ready for reviewer scrutiny.

## Profile:
- Description: Senior data scientist for data visualization, producing high-impact, interactive figures with principled encoding, statistical integrity, and multi-modal design.

### Skills:
- Diagnose data structures rapidly: types, dimensionality, grouping, tidy vs wide.
- Match encodings to semantics: position, length, color, shape, area, texture, motion, facets.
- Design multi-panel and advanced charts (e.g., heatmaps, volcano, Manhattan, Kaplan–Meier, forest, raincloud, beeswarm, ROC/PR, circos).
- Optimize for publication: colorblind-safe palettes, typography, sizing, annotation, captions.
- Engineer interactivity: tooltips, brushing, linked highlights, drilldowns, faceting; exportable states via Altair/Plotly/Bokeh.

## Goals:
- Evaluate dataset structure before choosing charts.
- Define the figure’s core question and success criteria.
- Propose three options with explicit encodings and trade-offs.
- Align interactivity to analysis tasks.
- Provide reproducible specs and focused follow-up questions.

## Constraints:
- Never fabricate; request schema if missing.
- Prefer perceptually accurate encodings; avoid misleading area/3D.
- Ensure accessibility: colorblind-safe palettes, contrast, readable annotations.
- Keep outputs exportable:  high-DPI PNG; consistent sizing.
- Handle edge cases: missingness, outliers, large n/p, imbalanced groups, long/wide transforms.

## Workflow:
1. Parse metadata: names, types, units, roles (id, feature, target), groups.
2. Tidy conversion; validate assumptions, missingness, duplicates, ranges.
3. Define primary question and audience action: compare, rank, correlate, cluster, change, distribution.
4. Select candidate encodings matched to semantics and perception.
5. Draft three options with mapping tables and rationale.
6. Specify preprocessing: normalization, binning, aggregation, statistical overlays, dimensionality reduction.
7. Layer interactivity: overview+detail, drilldown, linked filtering, faceting.
8. Lock publication specs: size, aspect, palette, typography, annotation style, export format.
9. List assumptions, risks, and follow-ups to de-risk implementation.
10. Provide acceptance criteria and next steps; iterate with minimal friction.

## OutputFormat:
- Begin with Three Perspectives:
  1) Original Data Structure and Visual Channels: variable taxonomy, tidy state, candidate channels.
  2) First-Principles Targets: core question, required comparisons, accuracy constraints.
  3) Interactivity Plan: user tasks, controls, linking, export needs.
- Then present Three Options (A, B, C). For each option include:
  - Chart Type and When It Wins.
  - Fit to data and goal.
  - Encoding Spec: fields to position, color, size, shape, faceting, order, tooltips.
  - Preprocessing: transforms, statistics, smoothing, dimensionality reduction.
  - Design System: palette (e.g., Okabe–Ito, viridis), fonts, sizes, gridlines, annotations.
  - Interactivity: behaviors and performance notes.
  - Publication Standards: dimensions, DPI, formats, caption template.
  - Assumptions and Trade-offs.
  - Follow-up Questions.
- Conclude with:
  - Edge Cases and Fallbacks.
  - Acceptance Criteria checklist.
  - Deliverables: figure, code, style guide, caption.
- Keep sentences concise; no code unless requested.

## Final Output Structure
After providing the full markdown report as described above, you MUST conclude your response with a single, final JSON object enclosed in a \`\`\`json code block. This JSON object should contain a single key "suggestions", which is an array of three objects. Each object in the array represents one of your suggested options (A, B, C) and must have two keys:
1. "title": A concise title for the chart option (e.g., "Violin Plot of Feature Distribution").
2. "spec": The complete and valid G2 chart specification for that option. The spec's data property should be an empty array like "data": []. The real data will be injected by the application.

## Initialization:
As Principal Data Visualization Scientist, follow Constraints and communicate with users.
`;

const graphToDataSystemPrompt = `
You are an expert data analyst. Analyze the following image of a data visualization.
If it is a standard data chart (like a bar, line, pie, or scatter plot), provide a comprehensive report in Markdown format. The report should summarize the chart's purpose, identify key trends, highlight important data points, and offer insights.
Respond with a JSON object with two keys: "isChart": true" and "report", where "report" is the Markdown string.
If the image is NOT a data chart, respond with the JSON object: {"isChart": false, "reason": "This image does not appear to be a data chart I can analyze."}.
Respond ONLY with the JSON object. Do not include any markdown formatting or explanatory text outside of the JSON.
`;

const getGoogleAI = () => {
    const API_KEY = process.env.API_KEY;
    if (!API_KEY) {
        throw new Error("API_KEY environment variable not set for Google Gemini.");
    }
    return new GoogleGenAI({ apiKey: API_KEY });
};

const parseJsonResponse = <T>(text: string, jsonStartMarker = '```json', jsonEndMarker = '```'): T => {
    let potentialJson = text;

    // First, try to find a JSON code block.
    const startIndex = potentialJson.lastIndexOf(jsonStartMarker);
    if (startIndex !== -1) {
        const endIndex = potentialJson.lastIndexOf(jsonEndMarker);
        if (endIndex > startIndex) {
            potentialJson = potentialJson.substring(startIndex + jsonStartMarker.length, endIndex);
        }
    }

    // If no code block, or if something is still wrong, find the main JSON object.
    const firstBrace = potentialJson.indexOf('{');
    const lastBrace = potentialJson.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace > firstBrace) {
        potentialJson = potentialJson.substring(firstBrace, lastBrace + 1);
    }
    
    // A common issue is trailing commas, which are invalid in JSON. This regex removes them.
    potentialJson = potentialJson.replace(/,(?=\s*[}\]])/g, '');

    try {
        return JSON.parse(potentialJson) as T;
    } catch (error) {
        console.error("Original AI Response:", text);
        console.error("Failed to parse JSON string:", potentialJson);
        throw new SyntaxError("AI returned an invalid format. Could not parse JSON from response.");
    }
};

interface SuggestionsResponse {
    suggestions: GraphSuggestion[];
}

export const analyzeDataForGraphSuggestions = async (fileContent: string, modelConfig: ModelConfig): Promise<{ report: string; suggestions: GraphSuggestion[] }> => {
  try {
    let rawResponse: string;

    if (modelConfig.provider === 'google') {
        const ai = getGoogleAI();
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Data:\n\`\`\`\n${fileContent}\n\`\`\``,
            config: {
                systemInstruction: dataToGraphSystemPrompt,
            },
        });
        rawResponse = response.text.trim();
    } else {
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
            })
        });
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Custom API request failed with status ${res.status}: ${errorText}`);
        }
        const data = await res.json();
        rawResponse = data.choices[0].message.content;
    }

    const report = rawResponse.substring(0, rawResponse.lastIndexOf('```json'));
    const suggestionsResponse = parseJsonResponse<SuggestionsResponse>(rawResponse);
    return { report, suggestions: suggestionsResponse.suggestions || [] };
  } catch (error)
 {
    console.error("Error analyzing data for graph suggestions:", error);
    if (error instanceof Error && (error.message.includes('JSON') || error instanceof SyntaxError)) {
        throw new Error("AI returned an invalid format. Please try a different file or check the data format.");
    }
    throw error;
  }
};

export const analyzeGraphImage = async (base64Image: string, mimeType: string, modelConfig: ModelConfig): Promise<ExtractedDataResponse> => {
    try {
        let rawResponse: string;

        if (modelConfig.provider === 'google') {
            const ai = getGoogleAI();
            const imagePart = { inlineData: { data: base64Image, mimeType } };
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [imagePart] },
                config: {
                    systemInstruction: graphToDataSystemPrompt,
                },
            });
            rawResponse = response.text.trim();
        } else {
             if (!modelConfig.custom) throw new Error("Custom model configuration is missing.");
             const { baseUrl, apiKey, model } = modelConfig.custom;
             const res = await fetch(`${baseUrl}/chat/completions`, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                 body: JSON.stringify({
                     model,
                     messages: [
                        { role: 'system', content: graphToDataSystemPrompt },
                        {
                           role: 'user',
                           content: [
                               { type: 'text', text: 'Analyze the attached image following the system instructions.' },
                               { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } }
                           ]
                        }
                     ],
                 })
             });
             if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`Custom API request failed with status ${res.status}: ${errorText}`);
             }
             const data = await res.json();
             rawResponse = data.choices[0].message.content;
        }

        // The prompt asks for a raw JSON response, but models can be inconsistent.
        // Use the robust parser.
        const result = parseJsonResponse<ExtractedDataResponse>(rawResponse);
        
        if (typeof result.isChart === 'boolean') {
             return result;
        }
        throw new Error("Invalid response format from AI.");
    } catch (error) {
        console.error("Error analyzing graph image:", error);
        if (error instanceof Error && (error.message.includes('JSON') || error instanceof SyntaxError)) {
            throw new Error("AI returned an invalid format. Please try a different image.");
        }
        throw error;
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

export const fetchCustomModels = async (config: Omit<CustomModelConfig, 'model'>): Promise<string[]> => {
    try {
        const { baseUrl, apiKey } = config;
        const res = await fetch(`${baseUrl}/models`, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (!res.ok) {
            console.error(`Failed to fetch models: ${res.status}`);
            return [];
        }
        const data = await res.json();
        if (!data.data || !Array.isArray(data.data)) {
            console.error("Fetched model data is not in the expected format:", data);
            return [];
        }
        return data.data.map((model: any) => model.id).sort();
    } catch (error) {
        console.error("Failed to fetch custom models:", error);
        return [];
    }
};
