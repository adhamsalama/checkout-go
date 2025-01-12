package customtypes

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
)

type StringSlice []string

// Scan implements the sql.Scanner interface to deserialize JSONB from the database
func (s *StringSlice) Scan(value any) error {
	if value == nil {
		*s = nil
		return nil
	}

	var data []byte
	switch v := value.(type) {
	case []byte:
		data = v
	case string:
		data = []byte(v)
	default:
		return fmt.Errorf("unsupported type: %T", value)
	}

	if err := json.Unmarshal(data, s); err != nil {
		return fmt.Errorf("failed to unmarshal JSON: %v", err)
	}
	return nil
}

// Value implements the driver.Valuer interface to serialize StringSlice to JSONB
func (s StringSlice) Value() (driver.Value, error) {
	if s == nil {
		return nil, nil
	}

	bytes, err := json.Marshal(s)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal JSON: %v", err)
	}
	return string(bytes), nil
}
