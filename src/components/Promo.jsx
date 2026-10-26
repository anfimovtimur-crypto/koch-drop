import { useState } from "react"
import promocodes from "../data/promocodes"


function Promo({
balance,
setBalance,
setToast
}){


const [code,setCode] = useState("")
const [message,setMessage] = useState("")



function activate(){


const promo = promocodes.find(
item => item.code === code.toUpperCase()
)


if(!promo){

setToast("Промокод не найден")
return

}



const usedPromos =
JSON.parse(localStorage.getItem("usedPromos")) || []



if(usedPromos.includes(promo.code)){

setToast("Вы уже использовали этот промокод")

return

}



if(promo.activations <= 0){

setMessage("Активации закончились")
return

}




setBalance(
balance + promo.amount
)



promo.activations--



usedPromos.push(promo.code)


localStorage.setItem(
"usedPromos",
JSON.stringify(usedPromos)
)



setToast(`+${promo.amount}₽ добавлено`)



setCode("")


}



return(

<div>


<h2>
Промокод
</h2>



<input

value={code}

onChange={(e)=>setCode(e.target.value)}

placeholder="Введите код"

/>



<button onClick={activate}>
Активировать
</button>



<p>
{message}
</p>



</div>

)


}


export default Promo