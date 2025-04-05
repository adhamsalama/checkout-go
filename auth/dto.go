package auth

type LoginInputDTO struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginOutputDTO struct {
	Token string `json:"token"`
}

type SignupInputDTO struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type SignupOutputDTO struct {
	Token string `json:"token"`
}
