import shutil, os
src = os.path.join(os.path.dirname(__file__), '_src.html')
dst = os.path.join(os.path.dirname(__file__), 'index.html')
shutil.copy2(src, dst)
print('Done')
