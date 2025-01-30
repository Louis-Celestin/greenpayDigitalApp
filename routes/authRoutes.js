const express = require("express")
const { userRegister, userLogin, userResetPassword } = require("../controllers/Auth/authController")
const router = express.Router()

router.post("/userRegister",userRegister)
router.post("/userLogin",userLogin)
router.post("/userResetPassword",userResetPassword)



module.exports = router