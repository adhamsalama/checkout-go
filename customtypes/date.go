package customtypes

import (
	"database/sql/driver"
	"fmt"
	"time"
)

type TimeWrapper time.Time

func (t *TimeWrapper) Scan(value any) error {
	if value == nil {
		*t = TimeWrapper(time.Time{}) // Handle NULL values
		return nil
	}
	// Expecting a string from SQLite, convert it to time.Time
	strValue, ok := value.(string)
	if !ok {
		return fmt.Errorf("unsupported type: %T", value)
	}
	parsedTime, err := time.Parse("2006-01-02T15:04:05Z", strValue)
	if err != nil {
		return fmt.Errorf("failed to parse time: %v", err)
	}
	*t = TimeWrapper(parsedTime)
	return nil
}

func (t TimeWrapper) Time() time.Time {
	return time.Time(t)
}

// Value implements the driver.Valuer interface
func (t TimeWrapper) Value() (driver.Value, error) {
	if time.Time(t).IsZero() {
		return nil, nil // Handle zero time values as NULL in the database
	}
	return time.Time(t).Format("2006-01-02 15:04:05"), nil
}
