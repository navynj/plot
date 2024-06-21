'use client';

import EmojiInput from '@/components/emoji/EmojiInput';
import Loader from '@/components/loader/Loader';
import OverlayForm from '@/components/overlay/OverlayForm';
import Tab from '@/components/tab/Tab';
import { categoriesAtom } from '@/store/category';
import { emojiAtom } from '@/store/emoji';
import { subjectsAtom } from '@/store/subject';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAtom, useAtomValue } from 'jotai';
import { LexoRank } from 'lexorank';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { FaPencil } from 'react-icons/fa6';
import * as z from 'zod';

const formSchema = z.object({
  icon: z.string().min(1, 'Please select icon.'),
  title: z.string().min(1, 'Please enter the title.'),
  categoryId: z.string(),
});

type formSchemaType = z.infer<typeof formSchema>;

const SubjectEditOverlay = () => {
  const { data: categories, isPending, isError } = useAtomValue(categoriesAtom);
  const { data: subjects, refetch: refetchSubjects } = useAtomValue(subjectsAtom);
  const [emoji, setEmoji] = useAtom(emojiAtom);

  const [category, setCategory] = useState('');

  const params = useSearchParams();
  const subjectId = params.get('subjectId') || '';
  const showOverlay = params.get('subject-edit') || '';

  const form = useForm<formSchemaType>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      icon: '',
      title: '',
      categoryId: category,
    },
  });

  const submitHandler = async (values: formSchemaType) => {
    const url = process.env.NEXT_PUBLIC_BASE_URL + '/api/subject';

    let rank;
    if (subjects?.length) {
      const sorted = [...subjects];
      sorted.sort((a, b) => (a.rank < b.rank ? -1 : 1));
      const lastItem = sorted[subjects?.length - 1];
      rank = lastItem && lastItem.rank.genNext();
    } else {
      rank = LexoRank.middle();
    }

    const body = JSON.stringify({
      ...values,
      rank: subjectId ? undefined : rank.toString(),
      categoryId: values.categoryId || undefined,
    });

    if (subjectId) {
      await fetch(`${url}/${subjectId}`, { method: 'PATCH', body });
    } else {
      await fetch(url, { method: 'POST', body });
    }

    refetchSubjects();
  };

  useEffect(() => {
    if (showOverlay) {
      if (subjectId) {
        const subject = subjects?.find((subject) => subject.id === subjectId);
        setEmoji(subject?.icon || '');
        setCategory(subject?.categoryId || '');
        form.setValue('title', subject?.title || '');
      }
    } else {
      setEmoji('');
      form.reset();
    }
  }, [showOverlay, subjectId]);

  useEffect(() => {
    if (showOverlay && emoji) {
      form.setValue('icon', emoji, { shouldValidate: true });
    }
  }, [emoji, showOverlay]);

  useEffect(() => {
    console.log(category);
    form.setValue('categoryId', category);
  }, [category]);

  return (
    <OverlayForm
      id="subject-edit"
      className="[&>form]:flex [&>form]:flex-col [&>form]:px-8 [&>form]:items-center [&>form]:gap-4"
      title={subjectId ? 'Edit subject' : 'Add subject'}
      form={form}
      onSubmit={submitHandler}
      isRight={true}
    >
      <div className="my-4 flex flex-col gap-4 items-center">
        {/* 이모지 */}
        <EmojiInput
          params={`&subject-edit=show${subjectId ? '&subjectId=' + subjectId : ''}`}
          isCircle={true}
        >
          <input {...form.register('icon')} value={emoji} hidden />
        </EmojiInput>
        {/* 제목 */}
        <input
          placeholder="Enter the title"
          {...form.register('title')}
          className="text-center font-medium bg-gray-100 px-3 py-2.5 rounded-lg"
        />
      </div>
      <div className="w-full flex flex-col items-center">
        <div className="w-full pb-1 mb-2 flex justify-between items-center border-b-2 border-black">
          <h6 className="font-extrabold">Category</h6>
          <Link href="/home/list?category-edit=show">
            <FaPencil className="text-xs" />
          </Link>
        </div>
        {/* 카테고리 */}
        <Tab
          id="subject-edit-catgory"
          value={category}
          setValue={setCategory}
          className="text-sm w-full [&>li]:p-1"
          tabs={[
            isPending ? <Loader key="loader" className="w-4 h-4" /> : undefined,
            ...(categories?.map((category, i) => ({
              label: category.title,
              value: category.id.toString(),
            })) || []),
            {
              label: 'etc.',
              value: '',
            },
          ]}
        />
      </div>
      {/* 에러 메시지 */}
      {!!Object.keys(form.formState.errors).length && (
        <div className="w-full p-2 mt-4 text-sm bg-red-50 text-red-400 font-bold text-center rounded-lg">
          {form.formState.errors?.icon?.message && (
            <p>{form.formState.errors?.icon?.message}</p>
          )}
          {form.formState.errors?.title?.message && (
            <p>{form.formState.errors?.title?.message}</p>
          )}
          {form.formState.errors?.categoryId?.message && (
            <p>{form.formState.errors?.categoryId?.message}</p>
          )}
        </div>
      )}
    </OverlayForm>
  );
};

export default SubjectEditOverlay;
