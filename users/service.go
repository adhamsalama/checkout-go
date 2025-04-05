package users

import (
	"context"
	"errors"
	"fmt"
	"time"

	queries "checkout-go/users/generated"

	"github.com/doug-martin/goqu/v9"
	"github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/bcrypt"
)

type UsersService struct {
	DB *goqu.Database
}

type User struct {
	ID             int64
	Username       string
	HashedPassword string
	Date           string
}

func (service *UsersService) CreateUser(username, password string) (*User, error) {
	q := queries.New(service.DB)
	passwordBytes := []byte(password)

	hashedPasswordBytes, err := bcrypt.GenerateFromPassword(passwordBytes, bcrypt.DefaultCost)
	if err != nil {
		panic(err)
	}
	hashedPassword := string(hashedPasswordBytes)
	params := queries.CreateuserParams{
		Username: username,
		Password: hashedPassword,
		Date:     time.Now().Format(time.RFC3339),
	}
	user, err := q.Createuser(context.Background(), params)
	if err != nil {
		isUniqueConstraintError := service.isDBUniqueConstaintError(err)
		if isUniqueConstraintError {
			return nil, errors.New("username already taken")
		}
		return nil, err
	}
	userData := User{
		ID:             user.ID,
		Username:       user.Username,
		HashedPassword: user.Password,
		Date:           user.Date,
	}
	return &userData, nil
}

func (service *UsersService) VerifyUserPassword(username, password string) bool {
	q := queries.New(service.DB)
	savedHashedPassword, err := q.GetUserPassword(context.Background(), username)
	if err != nil {
		fmt.Printf("error in retreiving user password from db: %v\n", err)
		return false
	}
	savedHashedPasswordBytes := []byte(savedHashedPassword)
	inputPasswordBytes := []byte(password)
	hashErr := bcrypt.CompareHashAndPassword(savedHashedPasswordBytes, inputPasswordBytes)
	return hashErr == nil
}

func (service *UsersService) GetUserIfValidPassword(username, password string) (*User, error) {
	q := queries.New(service.DB)
	user, err := q.GetUser(context.Background(), username)
	if err != nil {
		fmt.Printf("error in retreiving user password from db: %v\n", err)
		return nil, errors.New("user not found")
	}
	savedHashedPasswordBytes := []byte(user.Password)
	inputPasswordBytes := []byte(password)
	hashErr := bcrypt.CompareHashAndPassword(savedHashedPasswordBytes, inputPasswordBytes)
	if hashErr != nil {
		return nil, errors.New("invalid password")
	}
	userData := User{
		ID:             user.ID,
		Username:       user.Username,
		HashedPassword: user.Password,
	}
	return &userData, nil
}

func (service *UsersService) isDBUniqueConstaintError(err error) bool {
	if sqliteErr, ok := err.(sqlite3.Error); ok {
		switch sqliteErr.ExtendedCode {
		case sqlite3.ErrConstraintUnique:
			{
				return true
			}
		}
	}

	return false
}
