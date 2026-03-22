const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');

/**
 * LLMService: A unified adapter for multiple AI providers.
 */
class LLMService {
  constructor(provider, modelName, apiKey) {
    this.provider = provider;
    this.modelName = modelName;
    this.apiKey = apiKey;
    this.client = this._initClient();
  }

  _initClient() {
    switch (this.provider) {
      case 'google':
        return new GoogleGenerativeAI(this.apiKey);
      case 'openai':
        return new OpenAI({ apiKey: this.apiKey });
      case 'anthropic':
        return new Anthropic({ apiKey: this.apiKey });
      default:
        throw new Error(`Unsupported provider: ${this.provider}`);
    }
  }

  async generateJSON(prompt) {
    console.log(`[LLMService] Calling ${this.provider}:${this.modelName}`);
    
    try {
      if (this.provider === 'google') {
        const model = this.client.getGenerativeModel({ model: this.modelName });
        const result = await model.generateContent(prompt);
        let text = result.response.text();
        return this._parseJSON(text);
      } 
      
      if (this.provider === 'openai') {
        const response = await this.client.chat.completions.create({
          model: this.modelName,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        });
        return JSON.parse(response.choices[0].message.content);
      }

      if (this.provider === 'anthropic') {
        const response = await this.client.messages.create({
          model: this.modelName,
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt + "\n\nResponse must be valid JSON." }]
        });
        return this._parseJSON(response.content[0].text);
      }
    } catch (err) {
      console.error(`[LLMService] Error with ${this.provider}:`, err);
      throw err;
    }
  }

  async generateText(prompt) {
    console.log(`[LLMService] Calling ${this.provider}:${this.modelName} (Text mode)`);
    try {
      if (this.provider === 'google') {
        const model = this.client.getGenerativeModel({ model: this.modelName });
        const result = await model.generateContent(prompt);
        return result.response.text();
      }

      if (this.provider === 'openai') {
        const response = await this.client.chat.completions.create({
          model: this.modelName,
          messages: [{ role: 'user', content: prompt }]
        });
        return response.choices[0].message.content;
      }

      if (this.provider === 'anthropic') {
        const response = await this.client.messages.create({
          model: this.modelName,
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }]
        });
        return response.content[0].text;
      }
    } catch (err) {
      console.error(`[LLMService] Error with ${this.provider}:`, err);
      throw err;
    }
  }

  _parseJSON(text) {
    try {
      // Clean markdown if present
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (e) {
      console.error("[LLMService] JSON Parse Error. Raw text:", text);
      throw e;
    }
  }
}

module.exports = LLMService;
