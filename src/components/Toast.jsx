import { useEffect, useState } from "react"
import "./Toast.css"


function Toast({message,setToast}){


const [show,setShow] = useState(false)



useEffect(()=>{


if(message){


setShow(true)


const timer = setTimeout(()=>{


setShow(false)

setToast("")


},3000)



return ()=>clearTimeout(timer)


}


},[message,setToast])



if(!show || !message)
return null



return(

<div className="toast">


<div className="toast-header">


<div className="toast-icon">
!
</div>


<div>


<div className="toast-title">
Уведомление
</div>


<div className="toast-message">
{message}
</div>


</div>


</div>


<div className="toast-line"></div>


</div>

)

}


export default Toast