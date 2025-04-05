package auth

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
)

type AuthController struct {
	AuthService *AuthService
}

type UserID int64

var UserIDKey UserID

func (c *AuthController) Login(w http.ResponseWriter, r *http.Request) {
	var reqBody LoginInputDTO
	if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	res, err := c.AuthService.login(reqBody.Username, reqBody.Password)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	err = json.NewEncoder(w).Encode(res)
	if err != nil {
		http.Error(w, "Failed to encode JSON", http.StatusInternalServerError)
		return
	}
}

func (c *AuthController) Signup(w http.ResponseWriter, r *http.Request) {
	var reqBody SignupInputDTO
	if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	res, err := c.AuthService.signup(reqBody.Username, reqBody.Password)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	err = json.NewEncoder(w).Encode(res)
	if err != nil {
		http.Error(w, "Failed to encode JSON", http.StatusInternalServerError)
		return
	}
}

func (c *AuthController) RequireLoginMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("authorization")
		if authHeader == "" {
			http.Error(w, "authentication requried", http.StatusUnauthorized)
			return
		}
		token := strings.Replace(authHeader, "Bearer ", "", 1)
		tokenClaims, err := VerifyJWT(c.AuthService.HmacSecret, token)
		if err != nil {
			http.Error(w, "invalid token", http.StatusUnauthorized)
			return
		}
		ctx := context.WithValue(r.Context(), UserIDKey, tokenClaims.UserID)
		r = r.WithContext(ctx)

		next.ServeHTTP(w, r)
	})
}
