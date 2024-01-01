import React, { useContext } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AnimationWrapper from '../common/page-animation'
import toast, { Toaster } from 'react-hot-toast'
import { UserContext } from '../App'
import { EditorContext } from '../pages/editor.pages'
import Tag from './tags.component'
import axios from 'axios'

const PublishForm = () => {

  let { blog,
    blog: { banner, title, tags, des, content },
    setEditorState, setBlog
  } = useContext(EditorContext)
  let { userAuth: { access_token } } = useContext(UserContext);
  let navigate = useNavigate()

  let characterLimit = 200;
  let tagLimit = 10;

  const handleCloseEvent = () => {
    setEditorState("editor")
  }

  const handleBlogTitleChange = (e) => {
    let input = e.target;
    setBlog({ ...blog, title: input.value });
  };


  const handleBlogDesChange = (e) => {
    let input = e.target;
    setBlog({ ...blog, des: input.value })
  }

  const handleTitleKeyDown = (e) => {
    if (e.keyCode === 13) {
      e.preventDefault()
    }
  }

  const handleKeyDown = (e) => {
    if (e.keyCode === 13 || e.keyCode === 188) {
      e.preventDefault();
      let tag = e.target.value
      // console.log(tag)
      if (tags.length < tagLimit) {
        if (!tags.includes(tag) && tag.length) {
          setBlog({ ...blog, tags: [...tags, tag] })
        }
      } else {
        toast.error(`You can add max ${tagLimit} tags!`)
      }
      e.target.value = ""
    }
  }

  const publishBlog = (e) => {
    if (e.target.className.includes("disable")) {
      return;
    }
    if (!title.length) {
      return toast.error("Write blog title before publishing")
    }
    if (!des.length || des.length > characterLimit) {
      return toast.error(`Write a description about you blog within ${characterLimit} characters to publish`)
    }
    if (!tags.length || tags.length > tagLimit) {
      return toast.error(`Give minimum 1 and maximum ${tagLimit} tags to help us rank your blog`)
    }
    if (!banner.length) {
      return toast.error("You must upload a banner to publish the blog")
    }
    // if (!content.blocks.length) {
    //   return toast.error("There must be some blog content to publish the blog")
    // }
    let loadingToast = toast.loading("Publishing...")
    e.target.classList.add('disable')

    let blogObject = {
      title, banner, des, content, tags, draft: false
    }

    axios.post(import.meta.env.VITE_SERVER_DOMAIN + "/create-blog", blogObject, {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    }).then(() => {
      e.target.classList.remove('disable')
      toast.dismiss(loadingToast);
      toast.success("Published 👍🏻")
      setTimeout(() => {
        navigate("/")
      }, 500)
    }).catch(({ response }) => {
      e.target.classList.remove('disable')
      toast.dismiss(loadingToast);
      return toast.error(response.data.error)
    })
  }

  return (
    <AnimationWrapper>
      <section className='w-screen min-h-screen grid items-center lg:grid-cols-2 py-16 lg:gap-4'>
        <Toaster />
        <button
          className='w-12 h-12 absolute right-[5vw] z-10 top-[5%] lg:top-[10%]'
          onClick={handleCloseEvent}
        >
          <i className="fi fi-rr-cross"></i>
        </button>
        <div className='max-w-[550px] center'>
          <p className='text-dark-grey mb-1'>Preview</p>
          <div className='w-full aspect-video rounded-lg overflow-hidden bg-grey mt-4'>
            <img src={banner} alt="Banner" />
          </div>
          <h1 className="text-4xl font-medium mt-2 leading-tight line-clamp-2">{title}</h1>
          <p className='font-gelasio line-clamp-2 text-xl leading-7 mt-4'>{des}</p>
        </div>
        <div className='border-grey lg:border-1 lg:pl-8'>
          <p className='text-dark-grey mb-2 mt-9'>Blog Title</p>
          <input
            className='input-box pl-4'
            type="text"
            placeholder='Blog title'
            defaultValue={title}
            onChange={handleBlogTitleChange}
          />

          <p className='text-dark-grey mb-2 mt-9'>Short description about your blog</p>
          <textarea
            maxLength={characterLimit}
            defaultValue={des}
            className='h-40 resize-none leading-7 input-box pl-7'
            onChange={handleBlogDesChange}
            onKeyDown={handleTitleKeyDown}
          />

          <p className='mt-1 text-dark-grey text-sm text-right'>
            {characterLimit - des.length} characters left
          </p>

          <p className='text-dark-grey mb-2 mt-9'>
            Topics - ( Helps in searching and ranking your blog post )
          </p>

          <div className="relative input-box pl-2 py-2 pb-4">
            <input type="text"
              placeholder='Topic'
              className='sticky input-box bg-white top-0 left-0 pl-4 mb-3 focus:bg-white'
              onKeyDown={handleKeyDown}
            />
            {
              tags.map((tag, i) => {
                return <Tag tag={tag} tagIndex={i} key={i} />
              })
            }
          </div>
          <p className='mt-1 mb-4 text-dark-grey text-right'>
            {tagLimit - tags.length} Tags left
          </p>
          <button
            className='btn-dark px-8'
            onClick={publishBlog}
          >
            Publish
          </button>
        </div>
      </section>
    </AnimationWrapper>
  )
}

export default PublishForm
