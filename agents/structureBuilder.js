class StructureBuilderAgent {
  constructor(llmService) {
    this.llmService = llmService;
  }

  async buildStructure(originalTopic, topic, domain, maxDepth, detailLevel, uncertainAreas, learnings = []) {
    const prompt = `You are a STRUCTURE_BUILDER Agent.
Create a hierarchical mindmap structure for the topic: "${topic}".
Domain Type: ${domain}.
Detail Level: ${detailLevel}
Max Depth: ${maxDepth} levels. (Level 1 is root/H1, Level 2 is main branches/H2, etc.)
The following areas are uncertain and should be marked with a ⚠️: ${uncertainAreas.join(', ')}.

${learnings.length > 0 ? `PREVIOUS LEARNINGS TO APPLY:\n${learnings.map(l => `- ${l}`).join('\n')}\n` : ''}

Apply Systematic Decomposition based on the Domain Type. Ensure MECE (Mutually Exclusive, Collectively Exhaustive) where possible.
Always stop at Max Depth.

Respond ONLY with Markdown text. DO NOT wrap in markdown code blocks (\`\`\`).
The format MUST strictly be Markdown headings.
The VERY FIRST LINE MUST BE EXACTLY:
# ${originalTopic}

Then follow with the rest of the hierarchy, e.g.:
# Root Topic
## Main Branch 1
### Sub Branch A
### Sub Branch B
## Main Branch 2
### Sub Branch C

Do not include any other conversational text. Just the raw Markdown headings mimicking a tree structure up to H${maxDepth}.`;

    let attempt = 0;
    let lastError = null;

    while (attempt < 2) {
      try {
        let text = await this.llmService.generateText(prompt);
        text = text.replace(/```markdown/gi, '').replace(/```/g, '').trim();
        
        if (!text.startsWith('# ')) {
          text = `# ${originalTopic}\n` + text;
        } else {
          const lines = text.split('\n');
          lines[0] = `# ${originalTopic}`;
          text = lines.join('\n');
        }
        return text;
      } catch (e) {
        console.error(`Structure build error (attempt ${attempt + 1}):`, e);
        lastError = e;
        attempt++;
        if (attempt < 2) {
          // wait 4 seconds before retry
          await new Promise(r => setTimeout(r, 4000));
        }
      }
    }
    
    // If all retries failed
    return `# ${originalTopic}\n## API Error\n### ${lastError ? lastError.message.replace(/[\n\r]/g, ' ') : 'Unknown limit'}\n### Please wait a minute and try again.`;
  }
}

module.exports = StructureBuilderAgent;
