# Gemini Data Visualizer

A reversible data-to-visual web tool powered by AI. It transforms data files (CSV, JSON, TXT) into insightful graphs and, conversely, extracts structured data from graph images.

## Features

- **Data to Graph**: Upload a data file and get multiple AI-suggested chart types (Bar, Line, Pie, etc.) rendered with `recharts`.
- **Graph to Data**: Upload an image of a chart and have the AI extract the underlying data into a table, JSON, CSV, or Markdown.
- **URL Support**: Fetch data or image files directly from a public URL.
- **Flippable Interface**: A sleek, intuitive UI that "flips" between the two modes.
- **Localization**: Supports English and Chinese.
- **Custom AI Models**: A built-in Model Manager allows you to switch between the default Google Gemini model and any custom OpenAI-compatible API endpoint.

## Setup and Deployment

This is a static web application that can be deployed on any modern static hosting service.

### API Key Configuration

The application requires an API key to interact with AI models.

#### 1. Google Gemini (Default)

The tool is configured to use the Google Gemini API by default. To set this up:

1.  Obtain an API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
2.  Set this key as an environment variable named `API_KEY` in your deployment environment.

For example, if you are deploying to a platform like Vercel or Netlify, you would add `API_KEY` to the project's environment variable settings.

#### 2. Custom OpenAI-Compatible API (Advanced)

You can configure the tool to use any API endpoint that is compatible with the OpenAI Chat Completions format (e.g., a self-hosted Llama model, an enterprise endpoint, etc.).

1.  Click the **Settings** (gear) icon in the top-right corner of the application to open the Model Manager.
2.  Switch to the **"Custom (OpenAI-like)"** tab.
3.  Enter the following details:
    *   **API Base URL**: The base URL of your API endpoint (e.g., `https://api.openai.com/v1` or `http://localhost:11434/v1`). The tool will append `/chat/completions` to this URL.
    *   **API Key**: The API key for your custom service.
    *   **Model Name**: The specific model identifier you wish to use (e.g., `gpt-4o`, `llama3`, etc.).
4.  Click **"Test Connection"** to verify your settings.
5.  Click **"Save"** to apply and store the configuration in your browser's local storage.

The application will now use your custom endpoint for all AI-powered tasks.
