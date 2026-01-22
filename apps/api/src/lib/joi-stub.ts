/**
 * Joi stub - provides minimal interface for configuration validation
 * This stub is used when the joi package is not available.
 * Install joi package for proper validation.
 */

// Export the JoiSchema type for external use
export interface JoiSchema {
  required(): JoiSchema;
  optional(): JoiSchema;
  default(value: unknown): JoiSchema;
  valid(...values: unknown[]): JoiSchema;
  min(value: number): JoiSchema;
  when(ref: string, options: { is: string; then: JoiSchema; otherwise?: JoiSchema }): JoiSchema;
}

interface JoiStatic {
  object(schema: Record<string, JoiSchema>): JoiSchema;
  string(): JoiSchema;
  number(): JoiSchema;
  boolean(): JoiSchema;
  required(): JoiSchema;
  optional(): JoiSchema;
}

const createSchema = (): JoiSchema => ({
  required: function() { return this; },
  optional: function() { return this; },
  default: function() { return this; },
  valid: function() { return this; },
  min: function() { return this; },
  when: function() { return this; },
});

const Joi: JoiStatic = {
  object: () => createSchema(),
  string: () => createSchema(),
  number: () => createSchema(),
  boolean: () => createSchema(),
  required: () => createSchema(),
  optional: () => createSchema(),
};

export default Joi;
