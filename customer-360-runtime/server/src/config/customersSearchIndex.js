export const CUSTOMERS_SEARCH_INDEX_DEFINITION = {
  mappings: {
    dynamic: false,
    fields: {
      customerId: [
        { type: "string" },
        {
          type: "autocomplete",
          tokenization: "edgeGram",
          minGrams: 3,
          maxGrams: 12
        }
      ],
      searchableName: [
        { type: "string" },
        {
          type: "autocomplete",
          tokenization: "edgeGram",
          minGrams: 2,
          maxGrams: 15,
          foldDiacritics: true
        }
      ],
      firstName: { type: "string" },
      lastName: { type: "string" },
      email: [
        { type: "string" },
        {
          type: "autocomplete",
          tokenization: "edgeGram",
          minGrams: 3,
          maxGrams: 24
        }
      ],
      msisdn: [
        { type: "string" },
        {
          type: "autocomplete",
          tokenization: "nGram",
          minGrams: 3,
          maxGrams: 8
        }
      ],
      segment: { type: "string" },
      market: { type: "string" },
      plan: { type: "string" },
      status: { type: "string" }
    }
  }
};

export const CUSTOMER_AUTOCOMPLETE_PATHS = ["searchableName", "email", "msisdn", "customerId"];
