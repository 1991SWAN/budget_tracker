import { GoogleGenAI, Type } from "@google/genai";
import { TransactionType, CategoryItem, Asset } from "../types";

// Helper to get AI instance safely
const getAI = () => {
  const apiKey = (process.env as any).GEMINI_API_KEY || (process.env as any).API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please set the GEMINI_API_KEY environment variable.");
  }
  return new GoogleGenAI({ apiKey });
};

export const GeminiService = {
  /**
   * Parses an image of a receipt to extract transaction details.
   * Uses provided categories and assets for better mapping.
   */
  parseReceipt: async (base64Image: string, categories: CategoryItem[] = [], assets: Asset[] = []) => {
    try {
      const ai = getAI();
      const categoryContext = categories.map(c => `- ${c.name} (ID: ${c.id})`).join('\n');
      const assetContext = assets.map(a => `- ${a.name} (ID: ${a.id}, Type: ${a.type})`).join('\n');

      const prompt = `Analyze this receipt. 
            Select the best matching Category ID and Asset ID from the provided lists below.
            
            Available Categories:
            ${categoryContext}
            
            Available Assets (Accounts/Payment Methods):
            ${assetContext}
            
            Special Instructions for Transfers:
            If this looks like a transfer between accounts, identify both 'asset_id' (source) and 'to_asset_id' (destination) from the provided Assets list.
            
            If the asset is not clear from the receipt, leave asset_id blank.
            If no category matches perfectly, pick the closest one or leave category_id blank.
            Default type to EXPENSE unless it looks like a refund, income, or transfer.
            Return results in JSON format matching the schema.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Image
              }
            },
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              amount: { type: Type.NUMBER, description: "Total amount paid (numeric)" },
              date: { type: Type.STRING, description: "Date in YYYY-MM-DD format" },
              merchant: { type: Type.STRING, description: "Store name (e.g., Starbucks)" },
              category_id: { type: Type.STRING, description: "The ID of the best matching category" },
              asset_id: { type: Type.STRING, description: "The ID of the source asset/account" },
              to_asset_id: { type: Type.STRING, description: "The ID of the destination asset/account (for transfers)" },
              type: { type: Type.STRING, enum: Object.values(TransactionType) },
              items: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "List of items purchased"
              },
            },
            required: ["amount", "merchant"]
          }
        }
      });

      return response.text ? JSON.parse(response.text) : null;
    } catch (error) {
      console.error("[Gemini] Receipt Parsing Error:", error);
      throw error;
    }
  },

  /**
   * Parses unstructured natural language text into transaction data.
   */
  parseTextRecord: async (text: string, categories: CategoryItem[] = [], assets: Asset[] = []) => {
    try {
      const ai = getAI();
      const categoryContext = categories.map(c => `- ${c.name} (ID: ${c.id})`).join('\n');
      const assetContext = assets.map(a => `- ${a.name} (ID: ${a.id})`).join('\n');

      const prompt = `Parse the following finance-related text and extract transaction details.
            Available Categories:
            ${categoryContext}
            
            Available Assets:
            ${assetContext}
            
            Special Instructions for Transfers:
            If the text describes a transfer (e.g., "A에서 B로 이체", "Transfer from A to B"), 
            identify both the source account ('asset_id') and the destination account ('to_asset_id') from the list.
            
            Current Date Context: ${new Date().toISOString().split('T')[0]}
            
            Text to parse: "${text}"
            
            Map the transaction to the most likely Category ID and Asset ID from the lists.
            If multiple transactions are mentioned, return all as an array.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
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
                category_id: { type: Type.STRING },
                asset_id: { type: Type.STRING, description: "Source account ID" },
                to_asset_id: { type: Type.STRING, description: "Destination account ID" },
                type: { type: Type.STRING, enum: Object.values(TransactionType) },
                memo: { type: Type.STRING }
              },
              required: ["amount", "type"]
            }
          }
        }
      });

      return response.text ? JSON.parse(response.text) : [];
    } catch (error) {
      console.error("[Gemini] Text Parsing Error:", error);
      throw error;
    }
  },

  /**
   * AI Financial Advisor: Analyzes trends and provides tips.
   */
  analyzeSpending: async (transactions: any[], assets: any[]) => {
    try {
      const ai = getAI();
      const recentTransactions = transactions.slice(0, 30); // Compact data
      const prompt = `Act as a professional financial advisor. Analyze this JSON data:
            Assets: ${JSON.stringify(assets)}
            Recent Transactions: ${JSON.stringify(recentTransactions)}
            
            Provide:
            1. Brief summary of current financial health.
            2. Top 3 actionable saving tips.
            3. A one-sentence motivational insight.
            Format as clean Markdown with bullet points.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });

      return response.text;
    } catch (error) {
      console.error("[Gemini] Analysis Error:", error);
      return "Unable to generate analysis at this time.";
    }
  },

  /**
   * Penny AI: Conversational Analyst & Action Engine
   */
  processPennyRequest: async (
    userInput: string,
    context: {
      transactions: any[];
      assets: any[];
      categories: any[];
    }
  ) => {
    try {
      const ai = getAI();
      const { transactions, assets, categories } = context;

      // Provide recent context
      const categoryContext = categories.map(c => `- ${c.name} (ID: ${c.id}, Type: ${c.type})`).join('\n');
      const assetContext = assets.map(a => `- ${a.name} (ID: ${a.id}, Balance: ${a.balance})`).join('\n');
      const transactionContext = transactions.slice(0, 50).map(t => ({
        id: t.id,
        date: t.date,
        amount: t.amount,
        merchant: t.merchant || t.memo,
        category: categories.find(c => c.id === t.category)?.name || t.category,
        asset: assets.find(a => a.id === t.assetId)?.name || t.assetId,
        type: t.type
      }));

      const prompt = `You are "Penny", a proactive and friendly financial assistant for the SmartPenny app.
            Your job is to answer user questions about their finances AND perform actions if requested.
            
            Current Date: ${new Date().toISOString().split('T')[0]}
            
            AVAILABLE CATEGORIES:
            ${categoryContext}
            
            AVAILABLE ASSETS (ACCOUNTS):
            ${assetContext}
            
            RECENT TRANSACTIONS:
            ${JSON.stringify(transactionContext)}
            
            USER INPUT: "${userInput}"
            
            INSTRUCTIONS:
            1. ANALYZE: Understand if the user is asking a question (e.g., "How much did I spend?") or requesting an action (e.g., "Delete my last Starbucks purchase", "Move yesterday's lunch to 'Education' category").
            2. RESPOND: Provide a concise, helpful answer in Korean (since the app is Korean-focused). Use a friendly tone.
            3. ACT: If an action is requested:
               - DELETE: Identify the correct transaction ID.
               - UPDATE: Identify transaction ID and fields to change (category_id, amount, etc.).
               - CREATE: Extract amount, date, category_id, asset_id.
            
            RESPONSE FORMAT (JSON ONLY):
            {
              "answer": "A friendly Korean response explaining what you found or what you're about to do.",
              "action": {
                "type": "CREATE" | "UPDATE" | "DELETE" | "NONE",
                "payload": {
                  // For DELETE: { "id": "tx_id" }
                  // For UPDATE: { "id": "tx_id", "category_id": "...", "amount": 1000, ... }
                  // For CREATE: { "amount": 5000, "date": "...", "category_id": "...", "asset_id": "...", "type": "EXPENSE" | "INCOME" | "TRANSFER" }
                },
                "confirmationRequired": boolean // Always true for any action that modifies data
              }
            }`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              answer: { type: Type.STRING },
              action: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, enum: ["CREATE", "UPDATE", "DELETE", "NONE"] },
                  payload: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING, description: "Transaction ID for UPDATE/DELETE" },
                      amount: { type: Type.NUMBER, description: "Amount in currency" },
                      date: { type: Type.STRING, description: "YYYY-MM-DD" },
                      merchant: { type: Type.STRING, description: "Store or merchant name" },
                      category_id: { type: Type.STRING, description: "Category UUID" },
                      asset_id: { type: Type.STRING, description: "Source asset UUID" },
                      to_asset_id: { type: Type.STRING, description: "Destination asset UUID (for transfers)" },
                      type: { type: Type.STRING, description: "Transaction type" },
                      memo: { type: Type.STRING, description: "Notes or description" }
                    }
                  },
                  confirmationRequired: { type: Type.BOOLEAN }
                }
              }
            },
            required: ["answer"]
          }
        }
      });

      return response.text ? JSON.parse(response.text) : { answer: "죄송해요, 이해하지 못했어요.", action: { type: "NONE" } };
    } catch (error) {
      console.error("[Gemini] Penny Request Error:", error);
      return { answer: "분석 중 오류가 발생했습니다.", action: { type: "NONE" } };
    }
  }
};