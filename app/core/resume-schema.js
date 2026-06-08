export const resumeJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["meta", "header", "sections"],
  properties: {
    meta: {
      type: "object",
      additionalProperties: false,
      required: ["mode", "level", "layout", "targetRole", "companyName", "location", "domain", "matchedSkills", "generatedBy"],
      properties: {
        mode: { type: "string", enum: ["ideal"] },
        level: { type: "string" },
        layout: { type: "string" },
        targetRole: { type: "string" },
        companyName: { type: "string" },
        location: { type: "string" },
        domain: { type: "string" },
        matchedSkills: {
          type: "array",
          items: { type: "string" }
        },
        generatedBy: { type: "string", enum: ["ai"] }
      }
    },
    header: {
      type: "object",
      additionalProperties: false,
      required: ["name", "targetRole", "location", "phone", "email", "portfolio", "linkedin"],
      properties: {
        name: { type: "string" },
        targetRole: { type: "string" },
        location: { type: "string" },
        phone: { type: "string" },
        email: { type: "string" },
        portfolio: { type: "string" },
        linkedin: { type: "string" }
      }
    },
    sections: {
      type: "object",
      additionalProperties: false,
      required: ["professionalSummary", "skills", "workExperience", "projects", "education"],
      properties: {
        professionalSummary: { type: "string" },
        skills: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["category", "items"],
            properties: {
              category: { type: "string" },
              items: {
                type: "array",
                items: { type: "string" }
              }
            }
          }
        },
        workExperience: {
          type: "array",
          minItems: 1,
          maxItems: 4,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["company", "location", "title", "dates", "environment", "bullets"],
            properties: {
              company: { type: "string" },
              location: { type: "string" },
              title: { type: "string" },
              dates: { type: "string" },
              environment: {
                type: "array",
                items: { type: "string" }
              },
              bullets: {
                type: "array",
                items: { type: "string" }
              }
            }
          }
        },
        projects: {
          type: "array",
          maxItems: 4,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "bullets"],
            properties: {
              name: { type: "string" },
              bullets: {
                type: "array",
                items: { type: "string" }
              }
            }
          }
        },
        education: { type: "string" }
      }
    }
  }
};
