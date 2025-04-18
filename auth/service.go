package auth

import (
	"errors"
	"net/http"

	"checkout-go/users"
)

type AuthService struct {
	UserService *users.UsersService
	HmacSecret  []byte
}

func (service *AuthService) login(username, password string) (*LoginOutputDTO, error) {
	user, err := service.UserService.GetUserIfValidPassword(username, password)
	if err != nil {
		return nil, errors.New("invalid credentials")
	}
	token := GenerateJWT(service.HmacSecret, user.ID, user.Username)
	return &LoginOutputDTO{Token: token}, nil
}

func (service *AuthService) signup(username, password string) (*SignupOutputDTO, error) {
	user, err := service.UserService.CreateUser(username, password)
	if err != nil {
		return nil, err
	}
	token := GenerateJWT(service.HmacSecret, user.ID, user.Username)
	return &SignupOutputDTO{Token: token}, nil
}

func (service *AuthService) GetUserIDFromRequest(req *http.Request) int64 {
	val := req.Context().Value(UserIDKey)
	userID, ok := val.(int64)
	if !ok {
		panic("UserID is not an int64")
	}
	return userID
}
