import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import Jards from './jardinains_react_app'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
     <Jards />
    </>
  )
}

export default App
