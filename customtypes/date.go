package customtypes

import (
	"bytes"
	"database/sql/driver"
	"encoding/binary"
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

func (t TimeWrapper) MarshalJSON() ([]byte, error) {
	return []byte(`"` + t.Time().Format(time.RFC3339) + `"`), nil
}

func (ct *TimeWrapper) UnmarshalJSON(data []byte) error {
	// Remove the surrounding quotes from the JSON string
	str := string(data)
	if len(str) < 2 {
		return fmt.Errorf("invalid date format: %s", str)
	}
	str = str[1 : len(str)-1]
	t, err := time.Parse(time.RFC3339, str)
	if err == nil {
		*ct = TimeWrapper(t)
		return nil
	}

	t, err = time.Parse(time.DateOnly, str)
	if err == nil {
		*ct = TimeWrapper(t)
		return nil
	}

	return fmt.Errorf("invalid date format: %s", err)
}

// UnmarshalBSON customizes the unmarshalling of TimeWrapper from BSON.
func (t *TimeWrapper) UnmarshalBSON(data []byte) error {
	var timestamp int64
	err := binary.Read(bytes.NewReader(data), binary.LittleEndian, &timestamp)
	if err != nil {
		return err
	}

	// Convert the timestamp (milliseconds) to seconds
	timestampSeconds := timestamp / 1000

	// Convert to time.Time
	time := time.Unix(timestampSeconds, 0)
	*t = TimeWrapper(time)
	return nil
}
