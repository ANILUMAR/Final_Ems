export type FormFieldType =
  | 'TEXT'
  | 'TEXTAREA'
  | 'NUMBER'
  | 'DATE'
  | 'SELECT'
  | 'LOOKUP'
  | 'TOGGLE'
  | 'RADIO'
  | 'EMAIL'
  | 'PHONE'
  | 'CURRENCY';

export interface OptionItem {
  label: string;
  value: string;
}

export interface FormFieldDefinition {
  fieldKey: string;
  fieldLabel: string;
  fieldType: FormFieldType;
  placeholder?: string;
  hint?: string;
  colSpan?: number; // 12 (full), 6 (half), 4 (one-third)
  defaultValue?: any;

  /* Validation Rules */
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  regexMessage?: string;
  unique?: boolean;

  /* Dropdown static options */
  options?: OptionItem[];

  /* Dynamic Cross-Master Lookup */
  lookupScreenCode?: string;
  lookupValueField?: string;
  lookupLabelField?: string;

  /* Data Table / Grid Configuration */
  showInGrid?: boolean;
  filterable?: boolean;
  sortable?: boolean;
  sortOrder?: number;
}

export interface DynamicFormSchema {
  id?: number;
  screenCode: string;
  screenName: string;
  module?: string;
  subModule?: string;
  description?: string;
  fields: FormFieldDefinition[];
  active?: boolean;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
  version?: number;
}

export interface DynamicMasterRecord {
  id: number;
  screenCode: string;
  data: Record<string, any>;
  active?: boolean;
  createdAt?: string;
  createdBy?: string;
  createdByName?: string;
  updatedAt?: string;
  updatedBy?: string;
  updatedByName?: string;
}

export interface DynamicMasterPageResult<T> {
  items: T[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

export interface LookupOption {
  value: string;
  label: string;
  id?: number;
}
