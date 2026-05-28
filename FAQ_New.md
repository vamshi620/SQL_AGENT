# SQL Agent FAQs - User Guide

---

## 1. What's the Difference Between General Chat Agent and Custom Agent?

- **General Chat Agent** is a basic conversational assistant that can answer questions and provide information, but doesn't have specialized knowledge about your specific business, database, or workflows. It's like talking to a general-purpose helper.

- **Custom Agent** is a specialized assistant built specifically for your organization, pre-trained with knowledge about your database structure, business rules, and specific workflows. It understands your unique requirements and can execute complex tasks tailored to your needs.

- **Custom Agents are more powerful** because they can perform actions (like creating database objects, running tests, generating documents) rather than just providing information. They act as intelligent colleagues who know your business inside and out.

---

## 2. Why Use a Custom Agent?

- **Saves Time & Reduces Errors** — Instead of writing SQL scripts manually, you describe what you need in simple language, and the agent generates production-ready code with built-in best practices, security checks, and testing.

- **Consistency & Quality** — Custom agents follow your organization's coding standards, naming conventions, and security policies automatically, ensuring every piece of code meets the same high quality bar.

- **End-to-End Automation** — A single request to a custom agent can trigger the entire workflow: creating requirements documents, generating SQL code, reviewing it for security, running tests, and producing test reports — all without manual intervention.

---

## 3. How Do Agents Learn About Your Database, Schema, and Business Rules?

- **Database Connection** — Agents connect to your SQL Server database and automatically fetch the current schema (tables, columns, data types, relationships) in real-time. They see your actual database structure, not just a generic template.

- **Skills & Instructions** — Your agents are configured with reusable skills that contain your organization's rules: naming conventions (how to name tables/procedures), security policies (which operations are allowed), performance guidelines, and testing standards.

- **Project Knowledge** — Information about your business processes, previous decisions, and project context is stored in a shared "whiteboard" file (MEMORY.md) that all agents can read and update, so they build institutional knowledge over time.

---

## 4. How Are Agents Aware of and Connected to Your SQL Server Database?

- **Configuration via Environment File** — You set up a `.env` file with your SQL Server connection details (server name, database name, username, password). This secure configuration tells the agents where and how to connect to your database.

- **MCP Server as Bridge** — An MCP (Model Context Protocol) server acts as the intermediary that agents use to connect to your database. Think of it as a translator and gatekeeper that handles all database communication securely and safely.

- **Real-Time Access** — Agents can fetch your live database schema, execute SQL commands (with safety checks), run tests, and generate reports by communicating through the MCP server — all in real-time without any manual setup for each request.

---

## 5. What Happens If Data Is Missing (e.g., No Claims Available for a Specific ID)?

- **Graceful Handling** — When an agent encounters missing data (like trying to find claims for ID "003" when none exist), it doesn't crash or produce errors. Instead, it recognizes the situation and continues processing intelligently.

- **Test Fallback Behavior** — If data is missing, agents use fallback test cases and edge case scenarios to validate that your system works correctly even when expected data isn't available. This ensures your code handles real-world situations where data might be incomplete.

- **Clear Reporting** — The agent documents what data was missing, why it matters, and how your system handled the absence of data in its reports. This helps you understand potential issues before they occur in production.

---

## 6. What Is MCP and What Role Does It Play?

- **MCP (Model Context Protocol) is a Communication Standard** — It's a universal protocol that allows AI agents to safely and securely communicate with external systems like your database, file systems, and APIs. Think of it as a "language" that agents use to talk to databases.

- **Security & Safety Gateway** — The MCP server acts as a gatekeeper that validates every request from an agent before it touches your database. It can enforce policies (like blocking dangerous DROP commands) and ensure only authorized operations are executed.

- **What It Does for You** — MCP lets agents fetch your database schema, run SQL scripts with dry-run protection, generate Word documents, run tests, and read/write files — all through a single secure connection that logs every action for audit purposes.

---

## 7. Do Agents Get Trained or Improve from Their Past Outputs?

- **No Automatic Learning** — Agents don't learn or improve automatically from the outputs they produce. They don't modify their own behavior based on previous results. Each agent invocation starts fresh with the same base knowledge and rules.

- **Knowledge Updates are Manual** — To improve agent performance, you update the rules and skills files in your project. If an agent consistently produces code that violates a standard you care about, you update that standard in the skills configuration, and all future agent runs will follow the new rule.

- **Learning from Projects** — While agents don't self-improve, you can use the MEMORY.md file to capture important lessons, decisions, and patterns from each project. New agents will then read this shared memory and apply that knowledge to future tasks.

---

## 8. What If an Agent's Output Doesn't Meet Your Expectations? How Do You Fix It?

- **Review & Provide Feedback** — As an end user, you can review the agent's output (SQL code, documents, test results) and provide specific feedback about what was wrong. For example: "The stored procedure is missing parameter validation" or "The naming convention doesn't match our standards."

- **Update Skills or Instructions** — Based on your feedback, update the relevant skills file or agent instructions in your project's configuration. This might mean clarifying a naming rule, adding a security requirement, or providing an example of the expected format. Once updated, the agent will follow the new rules in its next run.

- **Regenerate or Iterate** — Invoke the agent again with your refined requirements or feedback. The improved skills and instructions will guide the agent to produce better results. You can iterate multiple times until the output meets your standards, then save the finalized version.

---

## 9. How Can End Users Customize or Update Existing Agents?

- **Modify Configuration Files** — Agents are configured through readable files in your project (like `.agent.md` files and skill files). You can open these files, understand what each section does, and update rules, instructions, or examples without writing code. Changes take effect immediately on the next agent invocation.

- **Add Custom Skills or Rules** — If you need an agent to follow a new standard (like a different naming convention or security policy), you add that rule to the appropriate skills file. All agents that use that skill will automatically apply your new rules without needing separate updates.

- **No Code Knowledge Required** — Customizing agents doesn't require programming expertise. You work with simple markdown files that contain instructions and examples. You can clarify requirements, add business rules, provide examples, or refine instructions — all in plain language.

---

## Additional Resources

- **README.md** — Quick start guide and technical overview  
- **walkthrough.md** — Detailed explanation of the project structure and how everything fits together  
- **MEMORY.md** — Shared project notes and decision history (created during your first agent run)  

**Need more help?** Review the individual agent documentation in `.github/agents/` folder for agent-specific details.
