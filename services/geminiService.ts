import { GoogleGenAI, Type } from "@google/genai";
import { TransactionType, Category } from "../types";

// Helper to get AI instance safely
const getAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please set the API_KEY environment variable.");
  }
  return new GoogleGenAI({ apiKey });
};

export const GeminiService = {
  /**
   * Parses an image of a receipt to extract transaction details.
   */
  parseReceipt: async (base64Image: string) => {
    const ai = getAI();
    
    // Using gemini-3-flash-preview as it is multimodal and cost-effective for analysis
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg', // Assuming JPEG for simplicity, can be dynamic
              data: base64Image
            }
          },
          {
            text: `Analyze this receipt. Extract the total amount, date, merchant name, and categorize it into one of these categories: ${Object.values(Category).join(', ')}. 
            Return the result in JSON format.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            amount: { type: Type.NUMBER, description: "Total amount paid" },
            date: { type: Type.STRING, description: "Date of transaction in YYYY-MM-DD format" },
            merchant: { type: Type.STRING, description: "Name of the store or merchant" },
            category: { type: Type.STRING, description: "Best fitting category" },
            items: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of items purchased" }
          },
          required: ["amount", "merchant", "category"]
        }
      }
    });

    return response.text ? JSON.parse(response.text) : null;
  },

  /**
   * Parses unstructured text (e.g., SMS, copy-paste) into structured transaction data.
   */
  parseTextRecord: async (text: string) => {
    const ai = getAI();
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Parse the following finance-related text and extract transaction details.
      Text: "${text}"
      
      Categories allowed: ${Object.values(Category).join(', ')}.
      Transaction Types: EXPENSE, INCOME, TRANSFER.
      
      Return a JSON array of transactions found.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              amount: { type: Type.NUMBER },
              date: { type: Type.STRING, description: "YYYY-MM-DD" },
              merchant: { type: Type.STRING },
              category: { type: Type.STRING },
              type: { type: Type.STRING, enum: Object.values(TransactionType) },
              memo: { type: Type.STRING }
            },
            required: ["amount", "type", "merchant"]
          }
        }
      }
    });

    return response.text ? JSON.parse(response.text) : [];
  },

  /**
   * Analyzes spending history to provide advice.
   */
  analyzeSpending: async (transactions: any[], assets: any[]) => {
    const ai = getAI();
    
    // Limit data size to avoid token limits if history is huge
    const recentTransactions = transactions.slice(0, 50); 
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Act as a financial advisor. Here is a summary of the user's recent financial data in JSON format:
      
      Assets: ${JSON.stringify(assets)}
      Recent Transactions: ${JSON.stringify(recentTransactions)}
      
      Provide a brief, bulleted analysis of their spending habits and 3 specific actionable tips to save money.
      Format the output as Markdown.`
    });

    return response.text;
  }
};