const TABLE_GOVERNANCE = {
  customers: {
    classification: "confidential",
    containsPii: true,
    allowedRoles: ["crm_analyst", "customer_success", "metadata_agent"],
    owner: "CRM Data Office"
  },
  customer_value_segments: {
    classification: "internal",
    containsPii: false,
    allowedRoles: ["commercial_analyst", "metadata_agent"],
    owner: "Revenue Analytics"
  },
  plan_migrations: {
    classification: "internal",
    containsPii: false,
    allowedRoles: ["network_analyst", "metadata_agent"],
    owner: "Product Operations"
  },
  billing_events: {
    classification: "confidential",
    containsPii: true,
    allowedRoles: ["billing_analyst", "finance_analyst", "metadata_agent"],
    owner: "Billing Operations"
  },
  support_cases: {
    classification: "internal",
    containsPii: true,
    allowedRoles: ["support_analyst", "metadata_agent"],
    owner: "Customer Support"
  },
  plans: {
    classification: "public",
    containsPii: false,
    allowedRoles: ["product_analyst", "metadata_agent"],
    owner: "Product Catalog"
  },
  accounts: {
    classification: "confidential",
    containsPii: true,
    allowedRoles: ["enterprise_analyst", "metadata_agent"],
    owner: "Enterprise CRM"
  },
  churn_scores: {
    classification: "internal",
    containsPii: false,
    allowedRoles: ["risk_analyst", "metadata_agent"],
    owner: "Risk Science"
  },
  usage_metrics: {
    classification: "internal",
    containsPii: false,
    allowedRoles: ["network_analyst", "metadata_agent"],
    owner: "Network Telemetry"
  },
  contract_renewals: {
    classification: "confidential",
    containsPii: false,
    allowedRoles: ["finance_analyst", "metadata_agent"],
    owner: "Finance Planning"
  }
};

const COLUMN_POLICY = {
  customer_name: { classification: "confidential", containsPii: true },
  account_name: { classification: "confidential", containsPii: true },
  owner_name: { classification: "internal", containsPii: true }
};

export function applyGovernanceMetadata(catalog) {
  const tables = catalog.tables.map((table) => {
    const governance = TABLE_GOVERNANCE[table.tableName] ?? {
      classification: "internal",
      containsPii: false,
      allowedRoles: ["metadata_agent"],
      owner: "Data Platform"
    };

    return {
      ...table,
      classification: governance.classification,
      containsPii: governance.containsPii,
      allowedRoles: governance.allowedRoles,
      owner: governance.owner,
      columns: table.columns.map((column) => ({
        ...column,
        classification: COLUMN_POLICY[column.name]?.classification ?? "internal",
        containsPii: COLUMN_POLICY[column.name]?.containsPii ?? false
      }))
    };
  });

  return {
    ...catalog,
    tables
  };
}

export function collectPolicyWarnings(plan, tableCatalog) {
  const tableMap = new Map(tableCatalog.map((table) => [table.tableName, table]));
  const warnings = [];
  const sensitiveFields = [];

  for (const tableEntry of plan.tables ?? []) {
    const table = tableMap.get(tableEntry.tableName);
    if (!table) {
      continue;
    }

    if (table.classification === "restricted" || table.classification === "confidential") {
      warnings.push(
        `Table ${table.schemaName}.${table.tableName} is classified ${table.classification}.`
      );
    }

    if (table.containsPii) {
      sensitiveFields.push({
        tableName: table.tableName,
        columnName: "*",
        classification: table.classification,
        containsPii: true
      });
    }
  }

  for (const columnEntry of plan.columns ?? []) {
    const table = tableMap.get(columnEntry.tableName);
    const column = table?.columns?.find((item) => item.name === columnEntry.columnName);
    if (!column) {
      continue;
    }

    if (column.containsPii || column.classification === "restricted") {
      sensitiveFields.push({
        tableName: columnEntry.tableName,
        columnName: columnEntry.columnName,
        classification: column.classification,
        containsPii: column.containsPii
      });
      warnings.push(
        `Column ${columnEntry.tableName}.${columnEntry.columnName} is marked ${column.classification}${column.containsPii ? " and contains PII" : ""}.`
      );
    }
  }

  return {
    policyWarnings: [...new Set(warnings)],
    sensitiveFields
  };
}
